import { Schema } from "effect";
import { PlaceKind } from "./place-kind.ts";

/** WGS84 point, limited to the Nykarleby area (incl. the outer archipelago). */
export const GeoPoint = Schema.Struct({
  lat: Schema.Number.check(Schema.isBetween({ minimum: 63.3, maximum: 63.75 })),
  lng: Schema.Number.check(Schema.isBetween({ minimum: 21.7, maximum: 23.2 })),
});
export type GeoPoint = typeof GeoPoint.Type;

export const GazetteerKind = Schema.Literals([...PlaceKind.literals, "address"]);
export type GazetteerKind = typeof GazetteerKind.Type;

export const GazetteerSource = Schema.Literals(["nkby-2018", "manual"]);
export type GazetteerSource = typeof GazetteerSource.Type;

/** Why an entry has no coordinates yet. They are to be added by hand in data/sources/manual-places.json. */
export const MissingLocation = Schema.Literals([
  /** The geocoder put the name on its shared town-centre fallback point. */
  "geocoder-fallback",
  /** The geocoded point lies outside the Nykarleby area. */
  "outside-area",
  /** Added by hand (e.g. from an extracted page) without coordinates yet. */
  "added-by-hand",
]);
export type MissingLocation = typeof MissingLocation.Type;

/** A known modern place name in Nykarleby (data/gazetteer.json). */
export const GazetteerEntry = Schema.Struct({
  /** Lowercase, as in the source, e.g. "topeliusesplanaden 12". */
  name: Schema.NonEmptyString,
  kind: GazetteerKind,
  alternateNames: Schema.optionalKey(Schema.Array(Schema.String)),
  location: Schema.optionalKey(GeoPoint),
  missingLocation: Schema.optionalKey(MissingLocation),
  postcode: Schema.optionalKey(Schema.String.check(Schema.isPattern(/^\d{5}$/))),
  note: Schema.optionalKey(Schema.String),
  /** "manual" when the location comes from data/sources/manual-places.json. */
  source: GazetteerSource,
});
export type GazetteerEntry = typeof GazetteerEntry.Type;

/** A hand-made correction or addition (data/sources/manual-places.json), merged by name. */
export const ManualPlace = Schema.Struct({
  name: Schema.NonEmptyString,
  kind: Schema.optionalKey(GazetteerKind),
  alternateNames: Schema.optionalKey(Schema.Array(Schema.String)),
  location: Schema.optionalKey(GeoPoint),
  note: Schema.optionalKey(Schema.String),
});
export type ManualPlace = typeof ManualPlace.Type;

/** A page place name that is deliberately not in the gazetteer (data/sources/ignored-places.json). */
export const IgnoredPlace = Schema.Struct({
  name: Schema.NonEmptyString,
  reason: Schema.Literals(["outside-nykarleby", "too-generic"]),
});
export type IgnoredPlace = typeof IgnoredPlace.Type;

/** Coordinates attached to a PlaceMention by matching it against the gazetteer. */
export const PlaceGeo = Schema.Struct({
  ...GeoPoint.fields,
  /** Matched on the place's address, or on its name / alternate names. */
  match: Schema.Literals(["address", "name"]),
  gazetteerName: Schema.String,
  gazetteerKind: GazetteerKind,
  source: GazetteerSource,
});
export type PlaceGeo = typeof PlaceGeo.Type;

/** Raw files in data/sources/nkby-2018 (see its README). */
export const Nkby2018 = {
  geocodedLocales: Schema.Array(
    Schema.Struct({
      name: Schema.String,
      postcode: Schema.optionalKey(Schema.String),
      location: Schema.optionalKey(Schema.Struct({ lat: Schema.Number, lng: Schema.Number })),
    }),
  ),
  locales: Schema.Array(
    Schema.Struct({ zipCode: Schema.String, localeNames: Schema.Array(Schema.String) }),
  ),
  areas: Schema.Array(
    Schema.Struct({
      type: Schema.Literals(["area", "building", "village", "island", "water"]),
      localeNames: Schema.Array(Schema.String),
    }),
  ),
  postalAreas: Schema.Array(Schema.String),
};
export type Nkby2018Sources = { [K in keyof typeof Nkby2018]: (typeof Nkby2018)[K]["Type"] };
