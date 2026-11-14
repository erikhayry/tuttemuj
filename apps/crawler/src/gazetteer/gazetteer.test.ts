import type { PlaceMention } from "@tuttemuj/schema";
import { describe, expect, it } from "vitest";
import { buildGazetteer, normalizeName } from "./build.ts";
import { Gazetteer } from "./geocode.ts";

const CENTRE = { lat: 63.5217598, lng: 22.5303558 };
const fallbackNames = ["torget", "juthas", "tornskär", "kampen", "esplanaden"];

const entries = buildGazetteer(
  {
    geocodedLocales: [
      { name: "bankgatan", postcode: "66900", location: { lat: 63.5222, lng: 22.5351 } },
      { name: "bankgatan 25", postcode: "66900", location: { lat: 63.5218, lng: 22.5375 } },
      { name: "kyrkan", postcode: "", location: { lat: 63.5225, lng: 22.5261 } },
      { name: "torsön", postcode: "", location: { lat: 63.58, lng: 22.4 } },
      { name: "riksväg åtta", postcode: "66930", location: { lat: 62.23, lng: 21.5 } },
      ...fallbackNames.map((name) => ({ name, postcode: "", location: CENTRE })),
      { name: "gränden" },
    ],
    locales: [{ zipCode: "66900", localeNames: ["bankgatan", "storgatan"] }],
    areas: [
      { type: "island", localeNames: ["torsön", "tornskär"] },
      { type: "building", localeNames: ["kyrkan"] },
      { type: "area", localeNames: ["juthas"] },
    ],
    postalAreas: ["socklot"],
  },
  [
    { name: "Riksväg åtta", kind: "street", alternateNames: ["riksåttan"], note: "Highway" },
    { name: "torget", location: { lat: 63.523, lng: 22.53 } },
    { name: "nytt ställe", kind: "landmark", location: { lat: 63.5, lng: 22.5 } },
  ],
);
const byName = new Map(entries.map((e) => [e.name, e]));

describe("buildGazetteer", () => {
  it("classifies names from areas, postcodes and address numbers", () => {
    expect(byName.get("torsön")?.kind).toBe("island");
    expect(byName.get("kyrkan")?.kind).toBe("building");
    expect(byName.get("bankgatan")).toMatchObject({ kind: "street", postcode: "66900" });
    expect(byName.get("bankgatan 25")?.kind).toBe("address");
    expect(byName.get("socklot")?.kind).toBe("village");
    expect(byName.get("storgatan")).toMatchObject({ kind: "street", postcode: "66900" });
  });

  it("marks the shared fallback point and points outside the municipality as missing", () => {
    expect(byName.get("tornskär")).toMatchObject({ missingLocation: "geocoder-fallback" });
    expect(byName.get("tornskär")?.location).toBeUndefined();
    expect(byName.get("juthas")?.missingLocation).toBe("geocoder-fallback");
    expect(byName.get("riksväg åtta")?.missingLocation).toBe("outside-area");
    expect(byName.get("kyrkan")?.location).toEqual({ lat: 63.5225, lng: 22.5261 });
    expect(byName.get("kyrkan")?.missingLocation).toBeUndefined();
    expect(byName.get("storgatan")?.missingLocation).toBeUndefined();
  });

  it("applies manual corrections and additions", () => {
    expect(byName.get("riksväg åtta")).toMatchObject({
      kind: "street",
      alternateNames: ["riksåttan"],
      note: "Highway",
      source: "nkby-2018",
    });
    expect(byName.get("torget")).toMatchObject({
      location: { lat: 63.523, lng: 22.53 },
      source: "manual",
    });
    expect(byName.get("torget")?.missingLocation).toBeUndefined();
    expect(byName.get("nytt ställe")).toMatchObject({ kind: "landmark", source: "manual" });
  });

  it("is sorted with one entry per name", () => {
    const names = entries.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "sv")));
  });
});

describe("Gazetteer.locate", () => {
  const gazetteer = new Gazetteer(entries);
  const place = (p: Partial<PlaceMention> & Pick<PlaceMention, "name" | "kind">): PlaceMention => ({
    alternateNames: [],
    ...p,
  });

  it("prefers the address, then name and alternate names", () => {
    expect(
      gazetteer.locate(place({ name: "Häggbloms", kind: "building", address: "Bankgatan 25" })),
    ).toMatchObject({ match: "address", gazetteerName: "bankgatan 25", lat: 63.5218 });
    expect(
      gazetteer.locate(
        place({ name: "Nykarleby kyrka", kind: "building", alternateNames: ["Kyrkan"] }),
      ),
    ).toMatchObject({ match: "name", gazetteerName: "kyrkan" });
  });

  it("matches the gazetteer's alternate names", () => {
    expect(gazetteer.locate(place({ name: "Torget", kind: "landmark" }))).toMatchObject({
      gazetteerName: "torget",
      source: "manual",
    });
  });

  it("does not locate names without trusted coordinates", () => {
    expect(gazetteer.locate(place({ name: "Tornskär", kind: "island" }))).toBeUndefined();
    expect(gazetteer.locate(place({ name: "Riksåttan", kind: "street" }))).toBeUndefined();
    expect(gazetteer.locate(place({ name: "Storgatan", kind: "street" }))).toBeUndefined();
  });

  it("only uses street names for places that are streets", () => {
    expect(gazetteer.locate(place({ name: "Bankgatan", kind: "street" }))).toBeDefined();
    expect(gazetteer.locate(place({ name: "Bankgatan", kind: "farm" }))).toBeUndefined();
  });

  it("replaces stale geo on a page", () => {
    const stale = {
      lat: 63.4,
      lng: 22.4,
      match: "name",
      gazetteerName: "x",
      gazetteerKind: "other",
      source: "nkby-2018",
    } as const;
    const page = gazetteer.geocodePage({
      sourceUrl: "https://www.nykarlebyvyer.nu/a.htm",
      title: "A",
      summary: "",
      topics: [],
      people: [],
      events: [],
      places: [
        place({ name: "Tornskär", kind: "island", geo: stale }),
        place({ name: "Torsön", kind: "island" }),
      ],
      contentHash: "h",
      extractionVersion: 1,
      model: "m",
      extractedAt: "2026-11-15T00:00:00Z",
    });
    expect(page.places.map((p) => p.geo?.gazetteerName)).toEqual([undefined, "torsön"]);
  });
});

describe("normalizeName", () => {
  it("lowercases and drops brackets and dots", () => {
    expect(normalizeName("  Stortr.[äsket]  ")).toBe("stortr");
    expect(normalizeName("Gustav  Adolfsgatan")).toBe("gustav adolfsgatan");
  });
});
