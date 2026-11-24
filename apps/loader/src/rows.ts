import type { PageExtraction, PageGroup, PlaceEntity } from "@tuttemuj/schema";
import { GazetteerKind, IsoDateTime, normalizeName } from "@tuttemuj/schema";
import { Schema } from "effect";

/** Rows as they are written to the tables in supabase/migrations. Only derived facts, never page text. */
// Zod's `.nullable()` is `Schema.NullOr(...)`. The value is `null`, not a missing key, because
// that is what the database returns and expects.
export const PageRow = Schema.Struct({
  source_url: Schema.String,
  title: Schema.String,
  summary: Schema.String,
  topics: Schema.Array(Schema.String),
  duplicate_of: Schema.NullOr(Schema.String),
  comic_candidate: Schema.Unknown,
  content_hash: Schema.String,
  extraction_version: Schema.Int.check(Schema.isGreaterThan(0)),
  model: Schema.String,
  extracted_at: IsoDateTime,
});
export type PageRow = typeof PageRow.Type;

export const PlaceRow = Schema.Struct({
  id: Schema.String.check(Schema.isPattern(/^[a-z0-9]+(-[a-z0-9]+)*$/)),
  name: Schema.NonEmptyString,
  kind: GazetteerKind,
  aliases: Schema.Array(Schema.String),
  gazetteer_names: Schema.Array(Schema.String),
  /** EWKT for a PostGIS geography column, or null. */
  location: Schema.NullOr(Schema.String),
});
export type PlaceRow = typeof PlaceRow.Type;

export const PagePlaceRow = Schema.Struct({ page_url: Schema.String, place_id: Schema.String });
export type PagePlaceRow = typeof PagePlaceRow.Type;

export const EventRow = Schema.Struct({
  /** "<source url>#<n>": the n-th event on the page. */
  id: Schema.String,
  page_url: Schema.String,
  title: Schema.String,
  year: Schema.NullOr(Schema.Int),
  month: Schema.NullOr(Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 12 }))),
  day: Schema.NullOr(Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 31 }))),
  end_year: Schema.NullOr(Schema.Int),
  circa: Schema.Boolean,
  description: Schema.NullOr(Schema.String),
  people: Schema.Array(Schema.String),
});
export type EventRow = typeof EventRow.Type;

export const EventPlaceRow = Schema.Struct({ event_id: Schema.String, place_id: Schema.String });
export type EventPlaceRow = typeof EventPlaceRow.Type;

/** A person as one page names them. People are not merged across pages. */
export const PagePersonRow = Schema.Struct({
  page_url: Schema.String,
  name: Schema.NonEmptyString,
  alternate_names: Schema.Array(Schema.String),
  birth_year: Schema.NullOr(Schema.Int),
  death_year: Schema.NullOr(Schema.Int),
  roles: Schema.Array(Schema.String),
  description: Schema.NullOr(Schema.String),
});
export type PagePersonRow = typeof PagePersonRow.Type;

export type Rows = {
  pages: PageRow[];
  places: PlaceRow[];
  pagePlaces: readonly PagePlaceRow[];
  events: EventRow[];
  eventPlaces: readonly EventPlaceRow[];
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
      Schema.decodeUnknownSync(PageRow)({
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
    Schema.decodeUnknownSync(PlaceRow)({
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
        Schema.decodeUnknownSync(EventRow)({
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
        Schema.decodeUnknownSync(PagePersonRow)({
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
    pagePlaces: Schema.decodeUnknownSync(Schema.Array(PagePlaceRow))(pagePlaces),
    events,
    eventPlaces: Schema.decodeUnknownSync(Schema.Array(EventPlaceRow))(eventPlaces),
    pagePeople: [...pagePeople.values()],
  };
}
