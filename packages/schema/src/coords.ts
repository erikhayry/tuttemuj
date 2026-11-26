// The messages between the coords tool's page and its local server (apps/coords).
import { Schema } from "effect";
import { GazetteerKind, GeoPoint } from "./gazetteer.ts";
import { SourceUrl } from "./source.ts";

/** An image from a page that mentions the place. Loaded from nykarlebyvyer.nu, never rehosted. */
export const CoordsImage = Schema.Struct({
  url: SourceUrl,
  pageUrl: SourceUrl,
  pageTitle: Schema.String,
  alt: Schema.optionalKey(Schema.String),
  /** Much wider than tall, so it gets a row of its own. */
  panorama: Schema.Boolean,
  /** Why it is shown: tied to this place, on a page named after it, or on a page mentioning it. */
  match: Schema.Literals(["image", "page", "mention"]),
});
export type CoordsImage = typeof CoordsImage.Type;

/** One page that mentions the place, described in our own words. */
export const CoordsContext = Schema.Struct({
  sourceUrl: SourceUrl,
  title: Schema.String,
  /** The page's description of the place, or else our summary of the page. */
  text: Schema.String,
  address: Schema.optionalKey(Schema.String),
});
export type CoordsContext = typeof CoordsContext.Type;

export const CoordsPlace = Schema.Struct({
  name: Schema.NonEmptyString,
  kind: GazetteerKind,
  alternateNames: Schema.Array(Schema.String),
  note: Schema.optionalKey(Schema.String),
  pageCount: Schema.Int,
  context: Schema.Array(CoordsContext),
  images: Schema.Array(CoordsImage),
});
export type CoordsPlace = typeof CoordsPlace.Type;

export const CoordsNextRequest = Schema.Struct({ skipped: Schema.Array(Schema.String) });

export const CoordsNextResponse = Schema.Struct({
  /** Null when every place is located or skipped. */
  place: Schema.NullOr(CoordsPlace),
  /** Unlocated places mentioned on pages, skipped ones included. */
  remaining: Schema.Int,
});
export type CoordsNextResponse = typeof CoordsNextResponse.Type;

export const CoordsSaveRequest = Schema.Struct({
  name: Schema.NonEmptyString,
  /** What was pasted: "63.52, 22.52" or a Google Maps URL. */
  input: Schema.String,
});

export const CoordsRejection = Schema.Literals(["unreadable", "outside-area", "already-located"]);
export type CoordsRejection = typeof CoordsRejection.Type;

export const CoordsSaveResponse = Schema.Union([
  Schema.Struct({
    result: Schema.Literal("saved"),
    name: Schema.String,
    location: GeoPoint,
  }),
  Schema.Struct({ result: Schema.Literal("rejected"), reason: CoordsRejection }),
]);
export type CoordsSaveResponse = typeof CoordsSaveResponse.Type;
