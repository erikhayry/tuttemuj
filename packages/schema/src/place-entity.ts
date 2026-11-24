import { Schema } from "effect";
import { ArrayWithDefault } from "./defaults.ts";
import { GazetteerKind, GeoPoint } from "./gazetteer.ts";
import { SourceUrl } from "./source.ts";

/**
 * One real-world place, merged across pages and gazetteer entries (data/entities/places.json).
 * Contains only derived facts and links, never page text.
 */
export const PlaceEntity = Schema.Struct({
  /** Stable slug of the canonical name, e.g. "storbron". Suffixed "-2" on a clash. */
  id: Schema.String.check(Schema.isPattern(/^[a-z0-9]+(-[a-z0-9]+)*$/)),
  name: Schema.NonEmptyString,
  kind: GazetteerKind,
  /** Other names for the same place: gazetteer alternates, merged entries and names seen on pages. */
  aliases: ArrayWithDefault(Schema.String),
  location: Schema.optionalKey(GeoPoint),
  /** Gazetteer entries this place is built from. Empty when the place only exists on pages. */
  gazetteerNames: ArrayWithDefault(Schema.String),
  /** Every page that mentions the place. */
  pages: Schema.Array(SourceUrl).check(Schema.isMinLength(1)),
});
export type PlaceEntity = typeof PlaceEntity.Type;

/** A suspected duplicate or ambiguity that was not merged automatically (data/entities/places-review.json). */
export const PlaceReview = Schema.Struct({
  reason: Schema.Literals([
    /** Different places sit on exactly the same point. */
    "same-coordinates",
    /** One page mention matched several places by its names. */
    "mention-matches-several",
  ]),
  ids: Schema.Array(Schema.String).check(Schema.isMinLength(2)),
  detail: Schema.String,
});
export type PlaceReview = typeof PlaceReview.Type;

/** A hand-confirmed merge (data/sources/place-merges.json): all these names are one place. */
export const PlaceMerge = Schema.Struct({
  names: Schema.Array(Schema.NonEmptyString).check(Schema.isMinLength(2)),
  note: Schema.optionalKey(Schema.String),
});
export type PlaceMerge = typeof PlaceMerge.Type;
