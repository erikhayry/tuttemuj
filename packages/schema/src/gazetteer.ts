import { z } from "zod";
import { PlaceKind } from "./place-kind.ts";

/** WGS84 point, limited to the Nykarleby area (incl. the outer archipelago). */
export const GeoPoint = z.object({
  lat: z.number().min(63.3).max(63.75),
  lng: z.number().min(21.7).max(23.2),
});
export type GeoPoint = z.infer<typeof GeoPoint>;

export const GazetteerKind = z.enum([...PlaceKind.options, "address"]);
export type GazetteerKind = z.infer<typeof GazetteerKind>;

export const GazetteerSource = z.enum(["nkby-2018", "manual"]);

/** Why an entry has no coordinates yet. They are to be added by hand in data/sources/manual-places.json. */
export const MissingLocation = z.enum([
  /** The geocoder put the name on its shared town-centre fallback point. */
  "geocoder-fallback",
  /** The geocoded point lies outside the Nykarleby area. */
  "outside-area",
  /** Added by hand (e.g. from an extracted page) without coordinates yet. */
  "added-by-hand",
]);
export type MissingLocation = z.infer<typeof MissingLocation>;

/** A known modern place name in Nykarleby (data/gazetteer.json). */
export const GazetteerEntry = z.object({
  /** Lowercase, as in the source, e.g. "topeliusesplanaden 12". */
  name: z.string().min(1),
  kind: GazetteerKind,
  alternateNames: z.array(z.string()).optional(),
  location: GeoPoint.optional(),
  missingLocation: MissingLocation.optional(),
  postcode: z
    .string()
    .regex(/^\d{5}$/)
    .optional(),
  note: z.string().optional(),
  /** "manual" when the location comes from data/sources/manual-places.json. */
  source: GazetteerSource,
});
export type GazetteerEntry = z.infer<typeof GazetteerEntry>;

/** A hand-made correction or addition (data/sources/manual-places.json), merged by name. */
export const ManualPlace = z.object({
  name: z.string().min(1),
  kind: GazetteerKind.optional(),
  alternateNames: z.array(z.string()).optional(),
  location: GeoPoint.optional(),
  note: z.string().optional(),
});
export type ManualPlace = z.infer<typeof ManualPlace>;

/** A page place name that is deliberately not in the gazetteer (data/sources/ignored-places.json). */
export const IgnoredPlace = z.object({
  name: z.string().min(1),
  reason: z.enum(["outside-nykarleby", "too-generic"]),
});
export type IgnoredPlace = z.infer<typeof IgnoredPlace>;

/** Coordinates attached to a PlaceMention by matching it against the gazetteer. */
export const PlaceGeo = GeoPoint.extend({
  /** Matched on the place's address, or on its name / alternate names. */
  match: z.enum(["address", "name"]),
  gazetteerName: z.string(),
  gazetteerKind: GazetteerKind,
  source: GazetteerSource,
});
export type PlaceGeo = z.infer<typeof PlaceGeo>;

/** Raw files in data/sources/nkby-2018 (see its README). */
export const Nkby2018 = {
  geocodedLocales: z.array(
    z.object({
      name: z.string(),
      postcode: z.string().optional(),
      location: z.object({ lat: z.number(), lng: z.number() }).optional(),
    }),
  ),
  locales: z.array(z.object({ zipCode: z.string(), localeNames: z.array(z.string()) })),
  areas: z.array(
    z.object({
      type: z.enum(["area", "building", "village", "island", "water"]),
      localeNames: z.array(z.string()),
    }),
  ),
  postalAreas: z.array(z.string()),
};
export type Nkby2018Sources = { [K in keyof typeof Nkby2018]: z.infer<(typeof Nkby2018)[K]> };
