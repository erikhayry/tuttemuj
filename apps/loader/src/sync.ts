import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { PagePlaceRow, Rows } from "./rows.ts";

const BATCH = 500;

const chunks = <T>(items: T[], size = BATCH): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

const fail = (what: string, error: { message: string } | null) => {
  if (error) throw new Error(`${what}: ${error.message}`);
};

/** Every value of `column`, read a page at a time (the API returns at most 1000 rows). */
async function readAll(db: SupabaseClient, table: string, columns: string) {
  const rows: Record<string, string>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from(table)
      .select(columns)
      .order(columns.split(",")[0] as string)
      .range(from, from + 999);
    fail(`read ${table}`, error);
    const page = (data ?? []) as unknown as Record<string, string>[];
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

export type SyncResult = { upserted: Record<string, number>; removed: Record<string, number> };

/**
 * Make the database match `rows`. Safe to run again: rows are upserted by key, and rows that are no
 * longer in `data/` are removed (git is the source of truth).
 */
export async function syncRows(url: string, key: string, rows: Rows): Promise<SyncResult> {
  const db = createClient(url, key, { auth: { persistSession: false } });
  const upsert = async (table: string, items: object[], onConflict: string) => {
    for (const part of chunks(items)) {
      const { error } = await db.from(table).upsert(part, { onConflict });
      fail(`upsert ${table}`, error);
    }
  };

  await upsert("places", rows.places, "id");
  // Pages first without their duplicate links, then with them, so a link never points at a page
  // that has not been written yet.
  await upsert(
    "pages",
    rows.pages.map((p) => ({ ...p, duplicate_of: null })),
    "source_url",
  );
  await upsert(
    "pages",
    rows.pages.filter((p) => p.duplicate_of !== null),
    "source_url",
  );

  // Links: remove the ones that are gone, then add the current ones.
  const wanted = new Set(rows.pagePlaces.map((r) => `${r.page_url}\n${r.place_id}`));
  const existing = (await readAll(db, "page_places", "page_url,place_id")) as PagePlaceRow[];
  const staleLinks = existing.filter((r) => !wanted.has(`${r.page_url}\n${r.place_id}`));
  for (const r of staleLinks) {
    const { error } = await db
      .from("page_places")
      .delete()
      .eq("page_url", r.page_url)
      .eq("place_id", r.place_id);
    fail("delete page_places", error);
  }
  await upsert("page_places", rows.pagePlaces, "page_url,place_id");

  // Pages and places that no longer exist (their links go with them).
  const removeMissing = async (table: string, column: string, keep: string[]) => {
    const keepSet = new Set(keep);
    const gone = (await readAll(db, table, column))
      .map((r) => r[column] as string)
      .filter((v) => !keepSet.has(v));
    for (const part of chunks(gone, 100)) {
      const { error } = await db.from(table).delete().in(column, part);
      fail(`delete ${table}`, error);
    }
    return gone.length;
  };
  const removedPages = await removeMissing(
    "pages",
    "source_url",
    rows.pages.map((p) => p.source_url),
  );
  const removedPlaces = await removeMissing(
    "places",
    "id",
    rows.places.map((p) => p.id),
  );

  return {
    upserted: {
      pages: rows.pages.length,
      places: rows.places.length,
      page_places: rows.pagePlaces.length,
    },
    removed: { pages: removedPages, places: removedPlaces, page_places: staleLinks.length },
  };
}
