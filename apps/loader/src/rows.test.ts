import type { PageExtraction, PageGroup, PlaceEntity } from "@tuttemuj/schema";
import { describe, expect, it } from "vitest";
import { buildRows, toWkt } from "./rows.ts";

const url = (n: string) => `https://www.nykarlebyvyer.nu/sidor/${n}.html`;

const page = (n: string): PageExtraction => ({
  sourceUrl: url(n),
  title: n,
  summary: `Sammanfattning ${n}`,
  topics: [],
  people: [],
  places: [],
  events: [],
  comicCandidate: null,
  contentHash: "h",
  extractionVersion: 1,
  model: "m",
  extractedAt: "2026-11-01T10:00:00.000Z",
});

const place = (id: string, pages: string[], location?: PlaceEntity["location"]): PlaceEntity => ({
  id,
  name: id,
  kind: "landmark",
  aliases: [],
  gazetteerNames: [],
  pages,
  ...(location ? { location } : {}),
});

describe("toWkt", () => {
  it("writes longitude first", () => {
    expect(toWkt({ lat: 63.5, lng: 22.5 })).toBe("SRID=4326;POINT(22.5 63.5)");
  });
});

describe("buildRows", () => {
  const groups: PageGroup[] = [
    {
      primary: url("a"),
      duplicates: [
        { url: url("b"), kind: "english", evidence: ["same-images"] },
        { url: url("not-analysed"), kind: "variant", evidence: ["same-images"] },
      ],
    },
  ];

  it("links duplicates to their primary", () => {
    const { pages } = buildRows([page("a"), page("b")], [], groups);
    expect(pages.find((p) => p.source_url === url("b"))?.duplicate_of).toBe(url("a"));
    expect(pages.find((p) => p.source_url === url("a"))?.duplicate_of).toBeNull();
  });

  it("ignores a group whose primary is not analysed", () => {
    const { pages } = buildRows([page("b")], [], groups);
    expect(pages[0]?.duplicate_of).toBeNull();
  });

  it("keeps only links to analysed pages and writes locations", () => {
    const { places, pagePlaces } = buildRows(
      [page("a")],
      [
        place("storbron", [url("a"), url("gone")], { lat: 63.5, lng: 22.5 }),
        place("x", [url("a")]),
      ],
      [],
    );
    expect(pagePlaces).toEqual([
      { page_url: url("a"), place_id: "storbron" },
      { page_url: url("a"), place_id: "x" },
    ]);
    expect(places[0]?.location).toBe("SRID=4326;POINT(22.5 63.5)");
    expect(places[1]?.location).toBeNull();
  });
});

describe("buildRows people", () => {
  const person = (name: string, extra: Partial<PageExtraction["people"][number]> = {}) => ({
    name,
    alternateNames: [],
    roles: [],
    ...extra,
  });

  it("writes one row per person per page, with only what the page states", () => {
    const a = {
      ...page("a"),
      people: [person("Lars Pensar", { birthYear: 1850, roles: ["rådman"] }), person("Anna")],
    };
    const b = { ...page("b"), people: [person("Lars Pensar")] };
    const { pagePeople } = buildRows([a, b], [], []);
    expect(pagePeople).toHaveLength(3);
    expect(pagePeople[0]).toEqual({
      page_url: url("a"),
      name: "Lars Pensar",
      alternate_names: [],
      birth_year: 1850,
      death_year: null,
      roles: ["rådman"],
      description: null,
    });
  });

  it("merges a name written twice on one page", () => {
    const a = {
      ...page("a"),
      people: [
        person("Anna", { roles: ["lärare"] }),
        person("Anna", { deathYear: 1900, roles: ["gift"] }),
      ],
    };
    const { pagePeople } = buildRows([a], [], []);
    expect(pagePeople).toEqual([
      expect.objectContaining({ name: "Anna", death_year: 1900, roles: ["lärare", "gift"] }),
    ]);
  });
});
