import {
  type GazetteerEntry,
  type GazetteerKind,
  GeoPoint,
  type ManualPlace,
  type Nkby2018Sources,
} from "@tuttemuj/schema";

/** Lowercase, single spaces, no brackets: the key used for matching names. */
export const normalizeName = (name: string): string =>
  name
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, "")
    .replace(/[.]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const AREA_KIND: Record<Nkby2018Sources["areas"][number]["type"], GazetteerKind> = {
  area: "district",
  building: "building",
  village: "village",
  island: "island",
  water: "waterbody",
};

const STREET = /(gatan|vägen|väg|gränd|gränden|stigen|esplanaden|rundan|stået|tået|strandväg)$/;

/**
 * The geocoder put names it could not find on one point in the town centre.
 * A point shared by this many different names is treated as "unknown".
 */
const FALLBACK_SHARED_BY = 5;

/**
 * Merge the nkby-2018 files and the hand-made corrections into one sorted gazetteer, one entry per name.
 * Rejected source points are kept as `missingLocation` so they can be filled in by hand later.
 */
export function buildGazetteer(src: Nkby2018Sources, manual: ManualPlace[] = []): GazetteerEntry[] {
  const kinds = new Map<string, GazetteerKind>();
  for (const name of src.postalAreas) kinds.set(normalizeName(name), "village");
  for (const { type, localeNames } of src.areas) {
    for (const name of localeNames) kinds.set(normalizeName(name), AREA_KIND[type]);
  }
  const postcodes = new Map<string, string>();
  for (const { zipCode, localeNames } of src.locales) {
    for (const name of localeNames) postcodes.set(normalizeName(name), zipCode);
  }

  const pointKey = (p: { lat: number; lng: number }) => `${p.lat},${p.lng}`;
  const namesAtPoint = new Map<string, Set<string>>();
  for (const { name, location } of src.geocodedLocales) {
    if (!location) continue;
    const key = pointKey(location);
    namesAtPoint.set(key, (namesAtPoint.get(key) ?? new Set()).add(normalizeName(name)));
  }

  const entries = new Map<string, GazetteerEntry>();
  const kindOf = (name: string): GazetteerKind =>
    kinds.get(name) ?? (/\d/.test(name) ? "address" : STREET.test(name) ? "street" : "other");
  const entry = (name: string): GazetteerEntry => {
    let e = entries.get(name);
    if (!e) {
      e = { name, kind: kindOf(name), source: "nkby-2018" };
      const postcode = postcodes.get(name);
      if (postcode) e.postcode = postcode;
      entries.set(name, e);
    }
    return e;
  };

  for (const { name: raw, postcode, location } of src.geocodedLocales) {
    const name = normalizeName(raw);
    if (!name) continue;
    const e = entry(name);
    if (postcode && /^\d{5}$/.test(postcode)) e.postcode ??= postcode;
    if (!location || e.location) continue;
    const point = GeoPoint.safeParse(location);
    const shared = namesAtPoint.get(pointKey(location))?.size ?? 0;
    if (!point.success) e.missingLocation = "outside-area";
    else if (shared >= FALLBACK_SHARED_BY) e.missingLocation = "geocoder-fallback";
    else {
      e.location = point.data;
      delete e.missingLocation;
    }
  }
  for (const name of [...kinds.keys(), ...postcodes.keys()]) entry(name);

  for (const m of manual) {
    const e = entry(normalizeName(m.name));
    if (m.kind) e.kind = m.kind;
    if (m.alternateNames?.length) e.alternateNames = m.alternateNames;
    if (m.note) e.note = m.note;
    if (m.location) {
      e.location = m.location;
      e.source = "manual";
      delete e.missingLocation;
    } else if (!e.location && !e.missingLocation) {
      e.source = "manual";
      e.missingLocation = "added-by-hand";
    }
  }

  return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name, "sv"));
}
