import type { PageExtraction, PageGroup, PlaceEntity } from "@tuttemuj/schema";
import { GazetteerKind } from "@tuttemuj/schema";
import { z } from "zod";

/** Rows as they are written to the tables in supabase/migrations. Only derived facts, never page text. */
export const PageRow = z.object({
  source_url: z.string(),
  title: z.string(),
  summary: z.string(),
  topics: z.array(z.string()),
  duplicate_of: z.string().nullable(),
  comic_candidate: z.unknown().nullable(),
  content_hash: z.string(),
  extraction_version: z.int().positive(),
  model: z.string(),
  extracted_at: z.iso.datetime(),
});
export type PageRow = z.infer<typeof PageRow>;

export const PlaceRow = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  name: z.string().min(1),
  kind: GazetteerKind,
  aliases: z.array(z.string()),
  gazetteer_names: z.array(z.string()),
  /** EWKT for a PostGIS geography column, or null. */
  location: z.string().nullable(),
});
export type PlaceRow = z.infer<typeof PlaceRow>;

export const PagePlaceRow = z.object({ page_url: z.string(), place_id: z.string() });
export type PagePlaceRow = z.infer<typeof PagePlaceRow>;

export type Rows = { pages: PageRow[]; places: PlaceRow[]; pagePlaces: PagePlaceRow[] };

/** `duplicate_of` per duplicate page, only where both pages have been analysed. */
const duplicateMap = (groups: PageGroup[], known: Set<string>): Map<string, string> => {
  const map = new Map<string, string>();
  for (const g of groups) {
    if (!known.has(g.primary)) continue;
    for (const d of g.duplicates) if (known.has(d.url)) map.set(d.url, g.primary);
  }
  return map;
};

export const toWkt = (p: { lat: number; lng: number }): string =>
  `SRID=4326;POINT(${p.lng} ${p.lat})`;

/** Turn the files in `data/` into table rows. Links to pages that are not analysed are dropped. */
export function buildRows(
  pages: PageExtraction[],
  places: PlaceEntity[],
  groups: PageGroup[],
): Rows {
  const known = new Set(pages.map((p) => p.sourceUrl));
  const dupOf = duplicateMap(groups, known);

  const pageRows = pages
    .map((p) =>
      PageRow.parse({
        source_url: p.sourceUrl,
        title: p.title,
        summary: p.summary,
        topics: p.topics,
        duplicate_of: dupOf.get(p.sourceUrl) ?? null,
        comic_candidate: p.comicCandidate ?? null,
        content_hash: p.contentHash,
        extraction_version: p.extractionVersion,
        model: p.model,
        extracted_at: p.extractedAt,
      }),
    )
    .sort((a, b) => a.source_url.localeCompare(b.source_url));

  const placeRows = places.map((p) =>
    PlaceRow.parse({
      id: p.id,
      name: p.name,
      kind: p.kind,
      aliases: p.aliases,
      gazetteer_names: p.gazetteerNames,
      location: p.location ? toWkt(p.location) : null,
    }),
  );

  const pagePlaces = places.flatMap((p) =>
    p.pages.filter((url) => known.has(url)).map((url) => ({ page_url: url, place_id: p.id })),
  );

  return {
    pages: pageRows,
    places: placeRows,
    pagePlaces: z.array(PagePlaceRow).parse(pagePlaces),
  };
}
