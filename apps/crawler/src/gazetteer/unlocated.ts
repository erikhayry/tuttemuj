import type { GazetteerEntry, PageExtraction } from "@tuttemuj/schema";
import { normalizeName } from "./build.ts";

export type UnlocatedPlace = {
  name: string;
  kind: string;
  missingLocation?: string | undefined;
  /** Number of distinct pages that mention the place under any of its names. */
  pageCount: number;
  /** Source URLs of those pages, relative to the site root. */
  pages: string[];
};

const SITE = /^https:\/\/www\.nykarlebyvyer\.nu\//;

/** Gazetteer entries without coordinates, ranked by the number of pages that mention them. */
export function rankUnlocated(
  entries: GazetteerEntry[],
  pages: Pick<PageExtraction, "sourceUrl" | "places">[],
): UnlocatedPlace[] {
  const byName = new Map<string, GazetteerEntry>();
  for (const e of entries) {
    if (e.location) continue;
    for (const n of [e.name, ...(e.alternateNames ?? [])]) byName.set(normalizeName(n), e);
  }
  const pagesByEntry = new Map<GazetteerEntry, Set<string>>();
  for (const page of pages) {
    const url = page.sourceUrl.replace(SITE, "");
    for (const place of page.places) {
      for (const n of [place.name, ...place.alternateNames]) {
        const entry = byName.get(normalizeName(n));
        if (!entry) continue;
        const set = pagesByEntry.get(entry) ?? new Set<string>();
        set.add(url);
        pagesByEntry.set(entry, set);
      }
    }
  }
  return [...pagesByEntry]
    .map(([e, set]) => ({
      name: e.name,
      kind: e.kind,
      missingLocation: e.missingLocation,
      pageCount: set.size,
      pages: [...set].sort(),
    }))
    .sort((a, b) => b.pageCount - a.pageCount || a.name.localeCompare(b.name, "sv"));
}
