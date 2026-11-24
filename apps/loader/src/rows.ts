import type {
  FrontierEntry,
  ImageClassification,
  PageExtraction,
  PageGroup,
  PlaceEntity,
} from "@tuttemuj/schema";
import {
  GazetteerKind,
  IsoDateTime,
  isShowableImage,
  normalizeName,
  PageType,
  PersonPlaceRelationKind,
} from "@tuttemuj/schema";
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
  /** Null: not assessed yet (no v1 fields on the page). */
  page_type: Schema.NullOr(PageType),
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

export const PagePlaceRow = Schema.Struct({
  page_url: Schema.String,
  place_id: Schema.String,
  /** Where the place's name comes from, as this page says (our own words), or null. */
  name_origin: Schema.NullOr(Schema.String),
});
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

/** What a place was used for, as one page says it (v1 button "Vad fanns här förr?"). */
export const PlaceUseRow = Schema.Struct({
  /** "<source url>#<n>": the n-th use on the page. */
  id: Schema.String,
  page_url: Schema.String,
  place_id: Schema.String,
  use: Schema.NonEmptyString,
  start_year: Schema.NullOr(Schema.Int),
  end_year: Schema.NullOr(Schema.Int),
});
export type PlaceUseRow = typeof PlaceUseRow.Type;

/** How a person on a page is tied to a place (v1 buttons "Vem bodde här?" and "Vem arbetade här?"). */
export const PersonPlaceRelationRow = Schema.Struct({
  id: Schema.String,
  page_url: Schema.String,
  person_name: Schema.NonEmptyString,
  place_id: Schema.String,
  relation: PersonPlaceRelationKind,
  start_year: Schema.NullOr(Schema.Int),
  end_year: Schema.NullOr(Schema.Int),
});
export type PersonPlaceRelationRow = typeof PersonPlaceRelationRow.Type;

/** What a page says one of its large images shows (v1 button "Visa gamla bilder härifrån"). */
export const ImageFactRow = Schema.Struct({
  /** "<source url>#bild<n>" */
  id: Schema.String,
  page_url: Schema.String,
  image_number: Schema.Int.check(Schema.isGreaterThan(0)),
  year: Schema.NullOr(Schema.Int),
});
export type ImageFactRow = typeof ImageFactRow.Type;

export const ImageFactPlaceRow = Schema.Struct({
  image_id: Schema.String,
  place_id: Schema.String,
});
export type ImageFactPlaceRow = typeof ImageFactPlaceRow.Type;

/** A large image on a page and what Jev said about it. The image itself is never stored. */
export const PageImageRow = Schema.Struct({
  page_url: Schema.String,
  /** Position among the page's large images, from 1: the n in `[bild n]`. */
  image_number: Schema.Int.check(Schema.isGreaterThan(0)),
  url: Schema.String,
  width: Schema.Int,
  height: Schema.Int,
  /** Jev's answers (0 to 1). Null until classified, or when the image was skipped. */
  photo: Schema.NullOr(Schema.Number),
  building_visible: Schema.NullOr(Schema.Number),
  people_visible: Schema.NullOr(Schema.Number),
  /** A photograph with a building or people in it (`isShowableImage`). */
  showable: Schema.Boolean,
});
export type PageImageRow = typeof PageImageRow.Type;

export type Rows = {
  pages: PageRow[];
  places: PlaceRow[];
  pagePlaces: readonly PagePlaceRow[];
  events: EventRow[];
  eventPlaces: readonly EventPlaceRow[];
  pagePeople: PagePersonRow[];
  placeUses: PlaceUseRow[];
  relations: PersonPlaceRelationRow[];
  imageFacts: ImageFactRow[];
  imageFactPlaces: ImageFactPlaceRow[];
  pageImages: PageImageRow[];
};

/** Where the large images are (the crawl's frontier) and Jev's answers about them. */
export type ImageSources = {
  frontier: readonly FrontierEntry[];
  classes: readonly ImageClassification[];
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
  imageSources: ImageSources = { frontier: [], classes: [] },
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
        page_type: p.pageType ?? null,
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

  const index = placeIndex(places);

  // A mention on a page means the place entities that page links to under any of its names.
  const placeIdsFor = (page: PageExtraction, name: string): Set<string> => {
    const mention = page.places.find((p) => p.name === name);
    const byName = index.get(page.sourceUrl);
    const ids = new Set<string>();
    for (const key of [name, ...(mention?.alternateNames ?? [])].map(normalizeName))
      for (const placeId of byName?.get(key) ?? []) ids.add(placeId);
    return ids;
  };

  // `name_origin` comes from the page's mention of the place, so it is set per page and place.
  const nameOrigins = new Map<string, string>();
  for (const page of pages)
    for (const mention of page.places)
      if (mention.nameOrigin)
        for (const placeId of placeIdsFor(page, mention.name))
          nameOrigins.set(`${page.sourceUrl}\n${placeId}`, mention.nameOrigin);

  const pagePlaces = places.flatMap((p) =>
    p.pages
      .filter((url) => known.has(url))
      .map((url) => ({
        page_url: url,
        place_id: p.id,
        name_origin: nameOrigins.get(`${url}\n${p.id}`) ?? null,
      })),
  );

  const events: EventRow[] = [];
  const eventPlaces: EventPlaceRow[] = [];
  for (const page of pages) {
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
      for (const name of e.places) for (const placeId of placeIdsFor(page, name)) ids.add(placeId);
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

  // v1 fields. A name that matches no place entity (not located, or unknown) gives no row.
  const placeUses: PlaceUseRow[] = [];
  const relations: PersonPlaceRelationRow[] = [];
  const imageFacts: ImageFactRow[] = [];
  const imageFactPlaces: ImageFactPlaceRow[] = [];
  for (const page of pages) {
    let u = 0;
    for (const mention of page.places)
      for (const use of mention.uses ?? [])
        for (const placeId of placeIdsFor(page, mention.name))
          placeUses.push(
            Schema.decodeUnknownSync(PlaceUseRow)({
              id: `${page.sourceUrl}#${u++}`,
              page_url: page.sourceUrl,
              place_id: placeId,
              use: use.use,
              start_year: use.startYear ?? null,
              end_year: use.endYear ?? null,
            }),
          );
    let r = 0;
    for (const rel of page.relations ?? [])
      for (const placeId of placeIdsFor(page, rel.place))
        relations.push(
          Schema.decodeUnknownSync(PersonPlaceRelationRow)({
            id: `${page.sourceUrl}#${r++}`,
            page_url: page.sourceUrl,
            person_name: rel.person,
            place_id: placeId,
            relation: rel.relation,
            start_year: rel.startYear ?? null,
            end_year: rel.endYear ?? null,
          }),
        );
    for (const image of page.images ?? []) {
      const id = `${page.sourceUrl}#bild${image.image}`;
      imageFacts.push(
        Schema.decodeUnknownSync(ImageFactRow)({
          id,
          page_url: page.sourceUrl,
          image_number: image.image,
          year: image.year ?? null,
        }),
      );
      const ids = new Set(image.places.flatMap((name) => [...placeIdsFor(page, name)]));
      for (const placeId of ids) imageFactPlaces.push({ image_id: id, place_id: placeId });
    }
  }

  // Large images per analysed page, numbered like the `[bild n]` markers (position in the frontier's
  // list, from 1). Jev's answers are matched by image URL.
  const classOf = new Map(imageSources.classes.map((c) => [c.url as string, c]));
  const pageImages: PageImageRow[] = [];
  for (const entry of imageSources.frontier) {
    if (!known.has(entry.url)) continue;
    (entry.images ?? []).forEach((image, n) => {
      const c = classOf.get(image.url);
      const answered = c && !("skipped" in c) ? c : undefined;
      pageImages.push(
        Schema.decodeUnknownSync(PageImageRow)({
          page_url: entry.url,
          image_number: n + 1,
          url: image.url,
          width: image.width,
          height: image.height,
          photo: answered?.photo ?? null,
          building_visible: answered?.buildingVisible ?? null,
          people_visible: answered?.peopleVisible ?? null,
          showable: c ? isShowableImage(c) : false,
        }),
      );
    });
  }

  return {
    pages: pageRows,
    places: placeRows,
    pagePlaces: Schema.decodeUnknownSync(Schema.Array(PagePlaceRow))(pagePlaces),
    events,
    eventPlaces: Schema.decodeUnknownSync(Schema.Array(EventPlaceRow))(eventPlaces),
    pagePeople: [...pagePeople.values()],
    placeUses,
    relations,
    imageFacts,
    imageFactPlaces,
    pageImages,
  };
}
