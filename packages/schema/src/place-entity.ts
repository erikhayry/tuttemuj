import { z } from "zod";
import { GazetteerKind, GeoPoint } from "./gazetteer.ts";
import { SourceUrl } from "./source.ts";

/**
 * One real-world place, merged across pages and gazetteer entries (data/entities/places.json).
 * Contains only derived facts and links, never page text.
 */
export const PlaceEntity = z.object({
  /** Stable slug of the canonical name, e.g. "storbron". Suffixed "-2" on a clash. */
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  name: z.string().min(1),
  kind: GazetteerKind,
  /** Other names for the same place: gazetteer alternates, merged entries and names seen on pages. */
  aliases: z.array(z.string()).default([]),
  location: GeoPoint.optional(),
  /** Gazetteer entries this place is built from. Empty when the place only exists on pages. */
  gazetteerNames: z.array(z.string()).default([]),
  /** Every page that mentions the place. */
  pages: z.array(SourceUrl).min(1),
});
export type PlaceEntity = z.infer<typeof PlaceEntity>;

/** A suspected duplicate or ambiguity that was not merged automatically (data/entities/places-review.json). */
export const PlaceReview = z.object({
  reason: z.enum([
    /** Different places sit on exactly the same point. */
    "same-coordinates",
    /** One page mention matched several places by its names. */
    "mention-matches-several",
  ]),
  ids: z.array(z.string()).min(2),
  detail: z.string(),
});
export type PlaceReview = z.infer<typeof PlaceReview>;

/** A hand-confirmed merge (data/sources/place-merges.json): all these names are one place. */
export const PlaceMerge = z.object({
  names: z.array(z.string().min(1)).min(2),
  note: z.string().optional(),
});
export type PlaceMerge = z.infer<typeof PlaceMerge>;
