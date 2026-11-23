import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeName } from "@tuttemuj/schema";
import { z } from "zod";

/** Names shorter than this are too common as words to count as a place in a question. */
const MIN_NAME_LENGTH = 4;
const MAX_WORDS = 3;
const PAGE_SIZE = 1000;
const REFRESH_MS = 10 * 60 * 1000;

export const PlaceNameRow = z.object({
  id: z.string(),
  name: z.string(),
  aliases: z.array(z.string()),
});
export type PlaceNameRow = z.infer<typeof PlaceNameRow>;

/** Normalised place name -> ids of the places that go by it. */
export type PlaceNameIndex = Map<string, string[]>;

export function buildPlaceNameIndex(rows: PlaceNameRow[]): PlaceNameIndex {
  const index: PlaceNameIndex = new Map();
  for (const row of rows) {
    for (const raw of [row.name, ...row.aliases]) {
      const name = normalizeName(raw);
      if (name.length < MIN_NAME_LENGTH) continue;
      const ids = index.get(name) ?? [];
      if (!ids.includes(row.id)) ids.push(row.id);
      index.set(name, ids);
    }
  }
  return index;
}

/** The words of a question, lowercased, without punctuation. */
const words = (question: string): string[] =>
  normalizeName(question.replace(/[?!,;:"“”()]/g, " "))
    .split(" ")
    .filter(Boolean);

/**
 * Ids of the places a question names. Looks at every run of 1–3 words, longest first, so "gamla
 * kyrkan" wins over "kyrkan" and words used in a longer match are not matched again.
 */
export function findPlaceIds(question: string, index: PlaceNameIndex): string[] {
  const w = words(question);
  const used = new Set<number>();
  const found = new Set<string>();
  for (let size = Math.min(MAX_WORDS, w.length); size >= 1; size--) {
    for (let i = 0; i + size <= w.length; i++) {
      if ([...Array(size).keys()].some((k) => used.has(i + k))) continue;
      const ids = index.get(w.slice(i, i + size).join(" "));
      if (!ids) continue;
      for (const id of ids) found.add(id);
      for (let k = 0; k < size; k++) used.add(i + k);
    }
  }
  return [...found];
}

/**
 * How much a page gains for mentioning a place the question names. A place on a handful of pages
 * is a strong signal; a place on hundreds (Torget) says little about any one of them.
 */
export const NAME_BONUS = 0.12;
const FULL_BONUS_PAGES = 20;
export const nameBonus = (placePageCount: number): number =>
  NAME_BONUS * Math.min(1, FULL_BONUS_PAGES / Math.max(1, placePageCount));

/** Loads every place name once and refreshes it every ten minutes (about 2,000 small rows). */
export function placeNameLoader(db: SupabaseClient): () => Promise<PlaceNameIndex> {
  let cached: { at: number; index: PlaceNameIndex } | undefined;
  return async () => {
    if (cached && Date.now() - cached.at < REFRESH_MS) return cached.index;
    const rows: PlaceNameRow[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await db
        .from("places")
        .select("id,name,aliases")
        .order("id")
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(`places: ${error.message}`);
      const page = z.array(PlaceNameRow).parse(data);
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
    cached = { at: Date.now(), index: buildPlaceNameIndex(rows) };
    return cached.index;
  };
}
