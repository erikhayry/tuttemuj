import { Effect, Schema } from "effect";
import { PersonPlaceRelationKind } from "./entities.ts";
import { GazetteerKind } from "./gazetteer.ts";
import { SourceUrl } from "./source.ts";

/**
 * The 10 buttons of v1 (docs/v1-plan.md). The ids are stable: the app's message catalogs are keyed
 * by them (`buttons.who-lived-here.label`), so the API never sends UI text.
 */
export const ButtonId = Schema.Literals([
  "who-lived-here",
  "what-happened-here",
  "stories-from-here",
  "old-images-from-here",
  "old-maps",
  "what-was-here",
  "who-worked-here",
  "why-the-name",
  "on-this-day",
  "nearby",
]);
export type ButtonId = typeof ButtonId.Type;

// Query values arrive as strings, so numbers are coerced (`FiniteFromString`). A value that is
// already a number is accepted too, which keeps the same schema usable from code.
const Coerced = Schema.Union([Schema.Finite, Schema.FiniteFromString]);

/** Where the user is and how far to look. Bounds: Nykarleby and its surroundings. */
export const PositionQuery = Schema.Struct({
  lat: Coerced.check(Schema.isBetween({ minimum: 63.3, maximum: 63.75 })),
  lng: Coerced.check(Schema.isBetween({ minimum: 21.7, maximum: 23.2 })),
  /** Metres. Walking distance by default. */
  radius: Coerced.check(Schema.isInt(), Schema.isBetween({ minimum: 10, maximum: 2000 })).pipe(
    // Like Zod's `.default(200)`, but the default is an Effect.
    Schema.withDecodingDefaultKey(Effect.succeed(200)),
  ),
});
export type PositionQuery = typeof PositionQuery.Type;

/** Same as the position, plus how many results to return. */
export const ButtonQuery = PositionQuery.mapFields((fields) => ({
  ...fields,
  limit: Coerced.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 100 })).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(50)),
  ),
  /**
   * For `on-this-day` only: the date to look for. Missing means today in Finland. Mostly for tests,
   * so they do not depend on the day they run.
   */
  month: Schema.optionalKey(
    Coerced.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 12 })),
  ),
  day: Schema.optionalKey(
    Coerced.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 31 })),
  ),
}));
export type ButtonQuery = typeof ButtonQuery.Type;

/** A place near the user, with the distance in whole metres. */
const PlaceRef = {
  placeId: Schema.String,
  placeName: Schema.String,
  distanceM: Schema.Int,
};

/** The page a result comes from. Every result links to it. Our own title, never page text. */
const Source = {
  sourceUrl: SourceUrl,
  pageTitle: Schema.String,
};

const Years = {
  startYear: Schema.optionalKey(Schema.Int),
  endYear: Schema.optionalKey(Schema.Int),
};

// `Schema.Struct({ button: Schema.Literal("…"), … })` makes each result carry its button id, so the
// union below can be told apart (a "tagged union", like a discriminated union in TypeScript).
const result = <Id extends ButtonId, Fields extends Schema.Struct.Fields>(id: Id, fields: Fields) =>
  Schema.Struct({ button: Schema.Literal(id), ...fields });

export const WhoLivedHere = result("who-lived-here", {
  ...PlaceRef,
  ...Source,
  personName: Schema.String,
  relation: PersonPlaceRelationKind,
  ...Years,
});

export const WhatHappenedHere = result("what-happened-here", {
  ...PlaceRef,
  ...Source,
  eventId: Schema.String,
  title: Schema.String,
  year: Schema.optionalKey(Schema.Int),
  month: Schema.optionalKey(Schema.Int),
  day: Schema.optionalKey(Schema.Int),
  endYear: Schema.optionalKey(Schema.Int),
  circa: Schema.Boolean,
  description: Schema.optionalKey(Schema.String),
});

export const StoriesFromHere = result("stories-from-here", {
  ...PlaceRef,
  ...Source,
  summary: Schema.String,
});

export const OldImagesFromHere = result("old-images-from-here", {
  ...PlaceRef,
  ...Source,
  /** On nykarlebyvyer.nu. The app loads it from there and links it to `sourceUrl`; it is never rehosted. */
  imageUrl: SourceUrl,
  year: Schema.optionalKey(Schema.Int),
});

export const OldMaps = result("old-maps", {
  ...PlaceRef,
  ...Source,
  summary: Schema.String,
});

export const WhatWasHere = result("what-was-here", {
  ...PlaceRef,
  ...Source,
  use: Schema.String,
  ...Years,
});

/** Either a person (`personName` and `relation`) or a use (`use`) of the place. */
export const WhoWorkedHere = result("who-worked-here", {
  ...PlaceRef,
  ...Source,
  personName: Schema.optionalKey(Schema.String),
  relation: Schema.optionalKey(PersonPlaceRelationKind),
  use: Schema.optionalKey(Schema.String),
  ...Years,
});

export const WhyTheName = result("why-the-name", {
  ...PlaceRef,
  ...Source,
  /** Our own words, one sentence. */
  nameOrigin: Schema.String,
});

export const OnThisDay = result("on-this-day", {
  ...PlaceRef,
  ...Source,
  eventId: Schema.String,
  title: Schema.String,
  year: Schema.optionalKey(Schema.Int),
  circa: Schema.Boolean,
  description: Schema.optionalKey(Schema.String),
});

/** A place close by to walk on to. It has its own pages, so there is no single source page. */
export const NearbyPlaceResult = result("nearby", {
  ...PlaceRef,
  kind: GazetteerKind,
  lat: Schema.Number,
  lng: Schema.Number,
  pageCount: Schema.Int,
});

export const ButtonResult = Schema.Union([
  WhoLivedHere,
  WhatHappenedHere,
  StoriesFromHere,
  OldImagesFromHere,
  OldMaps,
  WhatWasHere,
  WhoWorkedHere,
  WhyTheName,
  OnThisDay,
  NearbyPlaceResult,
]);
export type ButtonResult = typeof ButtonResult.Type;

/** `GET /buttons/:id` */
export const ButtonResultsResponse = Schema.Struct({
  button: ButtonId,
  results: Schema.Array(ButtonResult),
});
export type ButtonResultsResponse = typeof ButtonResultsResponse.Type;

/** `GET /buttons`: only the buttons that have results here, in button order. */
export const ButtonCount = Schema.Struct({
  button: ButtonId,
  count: Schema.Int.check(Schema.isGreaterThan(0)),
});
export const ButtonsResponse = Schema.Struct({ buttons: Schema.Array(ButtonCount) });
export type ButtonsResponse = typeof ButtonsResponse.Type;

/** `GET /places/near`: the located places close by that have pages, nearest first. */
export const PlacesNearResponse = Schema.Struct({ places: Schema.Array(NearbyPlaceResult) });
export type PlacesNearResponse = typeof PlacesNearResponse.Type;
