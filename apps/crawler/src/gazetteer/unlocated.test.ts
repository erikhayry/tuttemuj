import { describe, expect, it } from "vitest";
import { rankUnlocated } from "./unlocated.ts";

const page = (path: string, names: string[]) => ({
  sourceUrl: `https://www.nykarlebyvyer.nu/${path}`,
  places: names.map((name) => ({ name, kind: "square" as const, alternateNames: [] })),
});

describe("rankUnlocated", () => {
  it("ranks unlocated entries by distinct pages, matching alternate names", () => {
    const rows = rankUnlocated(
      [
        { name: "torget", kind: "square", source: "manual", alternateNames: ["stortorget"] },
        { name: "storbron", kind: "bridge", source: "manual" },
        {
          name: "kyrkan",
          kind: "building",
          source: "manual",
          location: { lat: 63.52, lng: 22.53 },
        },
      ] as never,
      [
        page("a.htm", ["Torget", "Storbron"]),
        page("b.htm", ["Stortorget", "Torget"]),
        page("c.htm", ["Kyrkan"]),
      ] as never,
    );
    expect(rows.map((r) => [r.name, r.pageCount])).toEqual([
      ["torget", 2],
      ["storbron", 1],
    ]);
  });
});
