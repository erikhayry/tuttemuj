import type { PageExtraction, PageGroup, PlaceEntity } from "@tuttemuj/schema";
import { GazetteerKind, normalizeName } from "@tuttemuj/schema";
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
  kind: z.enum(GazetteerKind.literals),
  aliases: z.array(z.string()),
  gazetteer_names: z.array(z.string()),
  /** EWKT for a PostGIS geography column, or null. */
  location: z.string().nullable(),
});
export type PlaceRow = z.infer<typeof PlaceRow>;

export const PagePlaceRow = z.object({ page_url: z.string(), place_id: z.string() });
export type PagePlaceRow = z.infer<typeof PagePlaceRow>;

export const EventRow = z.object({
  /** "<source url>#<n>": the n-th event on the page. */
  id: z.string(),
  page_url: z.string(),
  title: z.string(),
  year: z.int().nullable(),
  month: z.int().min(1).max(12).nullable(),
  day: z.int().min(1).max(31).nullable(),
  end_year: z.int().nullable(),
  circa: z.boolean(),
  description: z.string().nullable(),
  people: z.array(z.string()),
});
export type EventRow = z.infer<typeof EventRow>;

export const EventPlaceRow = z.object({ event_id: z.string(), place_id: z.string() });
export type EventPlaceRow = z.infer<typeof EventPlaceRow>;

/** A person as one page names them. People are not merged across pages. */
export const PagePersonRow = z.object({
  page_url: z.string(),
  name: z.string().min(1),
  alternate_names: z.array(z.string()),
  birth_year: z.int().nullable(),
  death_year: z.int().nullable(),
  roles: z.array(z.string()),
  description: z.string().nullable(),
});
export type PagePersonRow = z.infer<typeof PagePersonRow>;

export type Rows = {
  pages: PageRow[];
  places: PlaceRow[];
  pagePlaces: PagePlaceRow[];
  events: EventRow[];
  eventPlaces: EventPlaceRow[];
  pagePeople: PagePersonRow[];
};

/** `duplicate_of` per duplicate page, only where both pages have been analysed. */
const duplicateMap = (groups: readonly PageGroup[], known: Set<string>): Map<string, string> => {
  const map = new Map<string, string>();
  for (const g of groups) {
    if (!known.has(g.primary)) continue;
    for (const d of g.duplicates) if (known.has(d.url)) map.set(d.url, g.primary);
  }
  return map;
};

export const toWkt = (p: { lat: number; lng: number }): string =>
  `SRID=4326;POINT(${p.lng} ${p.lat})`;

/**
 * Place ids by page and normalised name: every name of a place, on every page that mentions it.
 * An event names a place as written on its page, so this finds the place the page means.
 */
const placeIndex = (places: readonly PlaceEntity[]): Map<string, Map<string, Set<string>>> => {
  const index = new Map<string, Map<string, Set<string>>>();
  for (const place of places) {
    const names = [place.name, ...place.aliases].map(normalizeName);
    for (const url of place.pages) {
      const byName = index.get(url) ?? new Map<string, Set<string>>();
      index.set(url, byName);
      for (const name of names) byName.set(name, (byName.get(name) ?? new Set()).add(place.id));
    }
  }
  return index;
};

/** Turn the files in `data/` into table rows. Links to pages that are not analysed are dropped. */
export function buildRows(
  pages: readonly PageExtraction[],
  places: readonly PlaceEntity[],
  groups: readonly PageGroup[],
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

  const index = placeIndex(places);
  const events: EventRow[] = [];
  const eventPlaces: EventPlaceRow[] = [];
  for (const page of pages) {
    const byName = index.get(page.sourceUrl);
    page.events.forEach((e, n) => {
      const id = `${page.sourceUrl}#${n}`;
      events.push(
        EventRow.parse({
          id,
          page_url: page.sourceUrl,
          title: e.title,
          year: e.date?.year ?? null,
          month: e.date?.month ?? null,
          day: e.date?.day ?? null,
          end_year: e.date?.endYear ?? null,
          circa: e.date?.circa ?? false,
          description: e.description ?? null,
          people: e.people,
        }),
      );
      // An event names a place as the page's place mention is called. Use all of the mention's names.
      const ids = new Set<string>();
      for (const name of e.places) {
        const mention = page.places.find((p) => p.name === name);
        const names = [name, ...(mention?.alternateNames ?? [])].map(normalizeName);
        for (const key of names) for (const placeId of byName?.get(key) ?? []) ids.add(placeId);
      }
      for (const placeId of ids) eventPlaces.push({ event_id: id, place_id: placeId });
    });
  }

  // One row per name per page; a name written twice on a page is merged.
  const pagePeople = new Map<string, PagePersonRow>();
  for (const page of pages) {
    for (const person of page.people) {
      const key = `${page.sourceUrl}\n${person.name}`;
      const before = pagePeople.get(key);
      const union = (a: readonly string[], b: readonly string[]) => [...new Set([...a, ...b])];
      pagePeople.set(
        key,
        PagePersonRow.parse({
          page_url: page.sourceUrl,
          name: person.name,
          alternate_names: union(before?.alternate_names ?? [], person.alternateNames),
          birth_year: person.birthYear ?? before?.birth_year ?? null,
          death_year: person.deathYear ?? before?.death_year ?? null,
          roles: union(before?.roles ?? [], person.roles),
          description: person.description ?? before?.description ?? null,
        }),
      );
    }
  }

  return {
    pages: pageRows,
    places: placeRows,
    pagePlaces: z.array(PagePlaceRow).parse(pagePlaces),
    events,
    eventPlaces: z.array(EventPlaceRow).parse(eventPlaces),
    pagePeople: [...pagePeople.values()],
  };
}
