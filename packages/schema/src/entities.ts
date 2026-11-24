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
export const HistoricalDate = Schema.Struct({
  year: Schema.Int,
  month: Schema.optionalKey(Month),
  day: Schema.optionalKey(Day),
  /** Last year of a span. Only set when the source states a span. */
  endYear: Schema.optionalKey(Schema.Int),
  circa: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  /** Original wording from the source. */
  text: Schema.optionalKey(Schema.String),
}).check(
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

export const PlaceMention = Schema.Struct({
  name: Schema.NonEmptyString,
  kind: PlaceKind,
  alternateNames: ArrayWithDefault(Schema.String),
  /** Address as written in the source (may be historical). */
  address: Schema.optionalKey(Schema.String),
  description: Schema.optionalKey(Schema.String),
  /** Added by geocoding against data/gazetteer.json, never by the analyst. */
  geo: Schema.optionalKey(PlaceGeo),
});
export type PlaceMention = typeof PlaceMention.Type;

/** What the analyst writes for a place: everything except the geocoded location. */
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
  comicCandidate: Schema.optionalKey(Schema.NullOr(ComicCandidate)),
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
