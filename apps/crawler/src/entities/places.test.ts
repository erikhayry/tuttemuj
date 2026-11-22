import type { GazetteerEntry } from "@tuttemuj/schema";
import { describe, expect, it } from "vitest";
import { resolvePlaces, slugify } from "./places.ts";

const entry = (e: Partial<GazetteerEntry> & { name: string }): GazetteerEntry =>
  ({ kind: "building", source: "manual", ...e }) as GazetteerEntry;

const page = (path: string, places: { name: string; alt?: string[]; kind?: string }[]) =>
  ({
    sourceUrl: `https://www.nykarlebyvyer.nu/${path}`,
    places: places.map((p) => ({
      name: p.name,
      kind: p.kind ?? "building",
      alternateNames: p.alt ?? [],
    })),
  }) as never;

describe("slugify", () => {
  it("drops diacritics and punctuation", () => {
    expect(slugify("Kuddnäs")).toBe("kuddnas");
    expect(slugify("Brunnen vid Klockstapeln")).toBe("brunnen-vid-klockstapeln");
    expect(slugify("§§")).toBe("place");
  });
});

describe("resolvePlaces", () => {
  const point = { lat: 63.52, lng: 22.52 };

  it("merges an entry that lists another entry's name as an alternate", () => {
    const { entities } = resolvePlaces(
      [
        entry({ name: "storbron", alternateNames: ["gamla storbron"], location: point }),
        entry({ name: "gamla storbron" }),
      ],
      [page("a.htm", [{ name: "Gamla storbron" }]), page("b.htm", [{ name: "Storbron" }])],
    );
    expect(entities).toHaveLength(1);
    expect(entities[0]).toMatchObject({
      id: "storbron",
      location: point,
      gazetteerNames: ["gamla storbron", "storbron"],
    });
    expect(entities[0]?.pages).toHaveLength(2);
  });

  it("merges hand-confirmed names and picks the most mentioned as canonical", () => {
    const { entities } = resolvePlaces(
      [entry({ name: "seminariet" }), entry({ name: "nykarleby seminarium", location: point })],
      [
        page("a.htm", [{ name: "Seminariet" }]),
        page("b.htm", [{ name: "Seminariet" }]),
        page("c.htm", [{ name: "Nykarleby seminarium" }]),
      ],
      [{ names: ["seminariet", "nykarleby seminarium"] }],
    );
    expect(entities).toHaveLength(1);
    expect(entities[0]).toMatchObject({ id: "seminariet", location: point });
    expect(entities[0]?.pages).toHaveLength(3);
  });

  it("rejects a merge naming something not in the gazetteer", () => {
    expect(() => resolvePlaces([entry({ name: "a" })], [], [{ names: ["a", "nope"] }])).toThrow(
      /nope/,
    );
  });

  it("keeps same-coordinate places apart and reports them", () => {
    const { entities, review } = resolvePlaces(
      [
        entry({ name: "brostugan", location: point }),
        entry({ name: "brostuguberget", location: point }),
      ],
      [page("a.htm", [{ name: "Brostugan" }, { name: "Brostuguberget" }])],
    );
    expect(entities).toHaveLength(2);
    expect(review).toEqual([
      expect.objectContaining({ reason: "same-coordinates", ids: ["brostugan", "brostuguberget"] }),
    ]);
  });

  it("counts a page for every place one mention points at, and reports it", () => {
    const { entities, review } = resolvePlaces(
      [
        entry({ name: "bankgatan", kind: "street" }),
        entry({ name: "norra torggatan", kind: "street" }),
      ],
      [page("a.htm", [{ name: "Bankgatan", alt: ["Norra torggatan"], kind: "street" }])],
    );
    expect(entities.map((e) => e.pages.length)).toEqual([1, 1]);
    expect(review[0]).toMatchObject({ reason: "mention-matches-several" });
  });

  it("does not match a street name to a non-street mention", () => {
    const { entities } = resolvePlaces(
      [entry({ name: "ahlnäs", kind: "street" })],
      [page("a.htm", [{ name: "Ahlnäs", kind: "farm" }])],
    );
    expect(entities).toHaveLength(1);
    expect(entities[0]?.gazetteerNames).toEqual([]);
  });

  it("creates page-only places for unmatched mentions and gives clashing slugs a suffix", () => {
    const { entities } = resolvePlaces(
      [],
      [
        page("a.htm", [{ name: "Kuddnäs" }, { name: "Kuddnas" }]),
        page("b.htm", [{ name: "kuddnäs" }]),
      ],
    );
    expect(entities.map((e) => [e.id, e.pages.length])).toEqual([
      ["kuddnas", 1],
      ["kuddnas-2", 2],
    ]);
  });

  it("omits gazetteer entries no page mentions", () => {
    expect(resolvePlaces([entry({ name: "ingen" })], []).entities).toEqual([]);
  });
});
