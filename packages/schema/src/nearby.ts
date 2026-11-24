import { Effect, Schema } from "effect";
import { HistoricalDate } from "./entities.ts";
import { GazetteerKind } from "./gazetteer.ts";
import { SourceUrl } from "./source.ts";

/** A number that arrives as a string in a query string, or as a number in JSON. */
const Coerced = Schema.Union([Schema.Finite, Schema.FiniteFromString]);

/** Query of GET /nearby. Values arrive as strings, so numbers are coerced. */
export const NearbyQuery = Schema.Struct({
  /** Same bounds as GeoPoint: Nykarleby and its surroundings. */
  lat: Coerced.check(Schema.isBetween({ minimum: 63.3, maximum: 63.75 })),
  lng: Coerced.check(Schema.isBetween({ minimum: 21.7, maximum: 23.2 })),
  /** Metres. Walking distance by default. */
  radius: Coerced.check(Schema.isInt(), Schema.isBetween({ minimum: 10, maximum: 2000 })).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(200)),
  ),
  limit: Coerced.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 100 })).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(20)),
  ),
});
export type NearbyQuery = typeof NearbyQuery.Type;

/** A page that mentions a place: our own title and summary, and the link to read the original. */
export const NearbyPage = Schema.Struct({
  sourceUrl: SourceUrl,
  title: Schema.String,
  summary: Schema.String,
});
export type NearbyPage = typeof NearbyPage.Type;

/** An event at a place, with the page it comes from. Description is our own wording. */
export const NearbyEvent = Schema.Struct({
  sourceUrl: SourceUrl,
  title: Schema.String,
  date: Schema.optionalKey(HistoricalDate),
  description: Schema.optionalKey(Schema.String),
});
export type NearbyEvent = typeof NearbyEvent.Type;

const NonNegativeInt = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

export const NearbyPlace = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  kind: GazetteerKind,
  aliases: Schema.Array(Schema.String),
  lat: Schema.Number,
  lng: Schema.Number,
  distanceM: NonNegativeInt,
  /** All pages mentioning the place; `pages` holds only the first few. */
  pageCount: NonNegativeInt,
  pages: Schema.Array(NearbyPage),
  /** All events at the place; `events` holds the first few in date order, undated last. */
  eventCount: NonNegativeInt,
  events: Schema.Array(NearbyEvent),
});
export type NearbyPlace = typeof NearbyPlace.Type;

/** Response of GET /nearby: the closest places first. Never contains page text. */
export const NearbyResponse = Schema.Struct({
  places: Schema.Array(NearbyPlace),
});
export type NearbyResponse = typeof NearbyResponse.Type;
