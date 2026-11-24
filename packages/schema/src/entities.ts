import { Effect, Schema, Struct } from "effect";
import { ArrayWithDefault } from "./defaults.ts";
import { PlaceGeo } from "./gazetteer.ts";
import { PlaceKind } from "./place-kind.ts";
import { IsoDateTime, SourceUrl } from "./source.ts";

const Month = Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 12 }));
const Day = Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 31 }));

/**
 * A date as precise as the source allows, e.g. "ca 1850", "maj 1918".
 * A span ("1873–1971", "1830-talet", "1600-talet") has `year` as its start and `endYear` as its end.
 */
// Effect: `Schema.Struct` fields are readonly in the TypeScript type, unlike Zod's object types.
export const HistoricalDate = Schema.Struct({
  year: Schema.Int,
  month: Schema.optionalKey(Month),
  day: Schema.optionalKey(Day),
  /** Last year of a span. Only set when the source states a span. */
  endYear: Schema.optionalKey(Schema.Int),
  circa: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  /** Original wording from the source. */
  text: Schema.optionalKey(Schema.String),
})
  // A rule over the whole struct (Zod: `.refine()`): `true` is valid, a string is the error message.
  .check(
    Schema.makeFilter(
      (d) => d.endYear === undefined || d.endYear > d.year || "endYear must be after year",
    ),
  );
export type HistoricalDate = typeof HistoricalDate.Type;

export const PersonMention = Schema.Struct({
  name: Schema.NonEmptyString,
  alternateNames: ArrayWithDefault(Schema.String),
  birthYear: Schema.optionalKey(Schema.Int),
  deathYear: Schema.optionalKey(Schema.Int),
  /** e.g. occupation, title */
  roles: ArrayWithDefault(Schema.String),
  description: Schema.optionalKey(Schema.String),
});
export type PersonMention = typeof PersonMention.Type;

/**
 * The years something lasted, when the page states them. Both are optional: "bodde här fram till
 * 1920" has only `endYear`. A single year is the same value in both.
 */
const YearSpanFields = {
  startYear: Schema.optionalKey(Schema.Int),
  endYear: Schema.optionalKey(Schema.Int),
};
const yearsInOrder = Schema.makeFilter<{ startYear?: number; endYear?: number }>(
  (d) =>
    d.startYear === undefined ||
    d.endYear === undefined ||
    d.endYear >= d.startYear ||
    "endYear must not be before startYear",
);

/** What a place was used for (v1 button "Vad fanns här förr?"), e.g. "apotek", "skola". */
export const PlaceUse = Schema.Struct({
  /** Short, lowercase Swedish: the thing the place was, e.g. "bageri". */
  use: Schema.NonEmptyString,
  ...YearSpanFields,
}).check(yearsInOrder);
export type PlaceUse = typeof PlaceUse.Type;

export const PlaceMention = Schema.Struct({
  name: Schema.NonEmptyString,
  kind: PlaceKind,
  alternateNames: ArrayWithDefault(Schema.String),
  /** Address as written in the source (may be historical). */
  address: Schema.optionalKey(Schema.String),
  description: Schema.optionalKey(Schema.String),
  /** Added by geocoding against data/gazetteer.json, never by the analyst. */
  geo: Schema.optionalKey(PlaceGeo),
  // The fields below are for v1 (#53). They are optional so older page files stay valid:
  // missing means "not assessed", an empty list means "assessed, nothing found".
  /** What the place was used for, with years when stated. */
  uses: Schema.optionalKey(Schema.Array(PlaceUse)),
  /** Where the name comes from, in our own words (Swedish, one sentence). Only if the page explains it. */
  nameOrigin: Schema.optionalKey(Schema.NonEmptyString),
});
export type PlaceMention = typeof PlaceMention.Type;

/** What the analyst writes for a place: everything except the geocoded location. */
// `mapFields(Struct.omit([...]))` is Zod's `.omit()`; `Struct.assign` below is `.extend()`.
export const PlaceMentionDraft = PlaceMention.mapFields(Struct.omit(["geo"]));
export type PlaceMentionDraft = typeof PlaceMentionDraft.Type;

export const EventMention = Schema.Struct({
  title: Schema.NonEmptyString,
  date: Schema.optionalKey(HistoricalDate),
  description: Schema.optionalKey(Schema.String),
  /** Names matching PersonMention.name */
  people: ArrayWithDefault(Schema.String),
  /** Names matching PlaceMention.name */
  places: ArrayWithDefault(Schema.String),
});
export type EventMention = typeof EventMention.Type;

/** How a person is tied to a place (v1 buttons "Vem bodde här?" and "Vem arbetade här?"). */
export const PersonPlaceRelationKind = Schema.Literals([
  "lived",
  "owned",
  "built",
  "ran",
  "worked",
  "born",
  "died",
]);
export type PersonPlaceRelationKind = typeof PersonPlaceRelationKind.Type;

export const PersonPlaceRelation = Schema.Struct({
  /** Name matching PersonMention.name */
  person: Schema.NonEmptyString,
  /** Name matching PlaceMention.name */
  place: Schema.NonEmptyString,
  relation: PersonPlaceRelationKind,
  ...YearSpanFields,
}).check(yearsInOrder);
export type PersonPlaceRelation = typeof PersonPlaceRelation.Type;

/** What one image on the page shows, when the page says (v1 button "Visa gamla bilder härifrån"). */
export const ImageFact = Schema.Struct({
  /** The number in the `[bild n]` marker of the extraction text (see #52). */
  image: Schema.Int.check(Schema.isGreaterThan(0)),
  /** Names matching PlaceMention.name */
  places: ArrayWithDefault(Schema.String),
  /** The year the image was made or shows, when stated. */
  year: Schema.optionalKey(Schema.Int),
});
export type ImageFact = typeof ImageFact.Type;

/** What kind of page it is. Used to find stories, photos and maps. */
export const PageType = Schema.Literals([
  "photo",
  "postcard",
  "map",
  "story",
  "article",
  "list",
  "menu",
]);
export type PageType = typeof PageType.Type;

/** A page whose story could be retold as a comic (used by a separate comics project). */
export const ComicCandidate = Schema.Struct({
  potential: Schema.Literals(["medium", "high"]),
  /** The story in our own words (Swedish, 1–3 sentences): who, what happens, what is at stake. */
  pitch: Schema.NonEmptyString,
  /** Why it works as a comic, e.g. a clear conflict, a vivid scene, a turning point (Swedish). */
  reason: Schema.NonEmptyString,
  /** Names matching PersonMention.name */
  characters: ArrayWithDefault(Schema.String),
  /** Names matching PlaceMention.name */
  places: ArrayWithDefault(Schema.String),
});
export type ComicCandidate = typeof ComicCandidate.Type;

/**
 * Derived facts from one source page (data/pages/<id>.json).
 * Never contains the page text itself, only our own summary and extracted facts.
 */
export const PageExtraction = Schema.Struct({
  sourceUrl: SourceUrl,
  title: Schema.String,
  /** Short summary in our own words (Swedish) */
  summary: Schema.String,
  topics: ArrayWithDefault(Schema.String),
  people: ArrayWithDefault(PersonMention),
  places: ArrayWithDefault(PlaceMention),
  events: ArrayWithDefault(EventMention),
  /** null = assessed, not a comic candidate. Missing = not assessed (older extractions). */
  // `NullOr` accepts `null` as a value (Zod `.nullable()`); `optionalKey` also allows the key to be missing.
  comicCandidate: Schema.optionalKey(Schema.NullOr(ComicCandidate)),
  // v1 fields (#53). Optional: pages extracted before v1 do not have them (see `enrichments`, #54).
  pageType: Schema.optionalKey(PageType),
  relations: Schema.optionalKey(Schema.Array(PersonPlaceRelation)),
  images: Schema.optionalKey(Schema.Array(ImageFact)),
  contentHash: Schema.String,
  extractionVersion: Schema.Int.check(Schema.isGreaterThan(0)),
  model: Schema.String,
  extractedAt: IsoDateTime,
});
export type PageExtraction = typeof PageExtraction.Type;

/** Bump when the extraction instructions or schema change, so pages get re-analysed. */
export const EXTRACTION_VERSION = 1;

/**
 * What the analyst (Claude Code, run manually) writes for one page.
 * Bookkeeping fields (hash, version, timestamp) are stamped by `extract:save`.
 */
export const PageExtractionDraft = PageExtraction.mapFields(
  Struct.omit(["contentHash", "extractionVersion", "extractedAt"]),
).mapFields(
  Struct.assign({
    places: ArrayWithDefault(PlaceMentionDraft),
    /** Required in drafts: the analyst always decides (null when not a candidate). */
    comicCandidate: Schema.NullOr(ComicCandidate),
  }),
);
export type PageExtractionDraft = typeof PageExtractionDraft.Type;

/** One page handed out for analysis (.cache/extract/batch.json). */
export const ExtractionTask = Schema.Struct({
  sourceUrl: SourceUrl,
  title: Schema.String,
  contentHash: Schema.String,
  textPath: Schema.String,
  draftPath: Schema.String,
});
export type ExtractionTask = typeof ExtractionTask.Type;
