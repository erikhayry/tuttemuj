import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { EvalSet } from "@tuttemuj/schema";
import { describe, expect, it } from "vitest";
import { score, summarise } from "./eval.ts";

const root = fileURLToPath(new URL("../../../", import.meta.url));

describe("score", () => {
  const relevant = ["a", "b", "c"];

  it("finds the first relevant page and its rank", () => {
    const s = score({ ranked: ["x", "a", "y", "b"], relevant });
    expect(s).toMatchObject({ firstHit: 2, hitAt5: true, hitAt8: true, reciprocalRank: 0.5 });
    expect(s.precisionAt5).toBeCloseTo(2 / 3);
  });

  it("separates the top 5 from the top 8 and from not found", () => {
    const ranked = ["x1", "x2", "x3", "x4", "x5", "x6", "a"];
    expect(score({ ranked, relevant })).toMatchObject({ firstHit: 7, hitAt5: false, hitAt8: true });
    expect(score({ ranked: ["x"], relevant })).toMatchObject({
      firstHit: undefined,
      hitAt8: false,
      reciprocalRank: 0,
      precisionAt5: 0,
    });
  });

  it("is perfect when the top results are all that could be relevant", () => {
    expect(score({ ranked: ["a"], relevant: ["a"] }).precisionAt5).toBe(1);
  });
});

describe("summarise", () => {
  it("averages the cases", () => {
    const s = summarise([
      score({ ranked: ["a"], relevant: ["a"] }),
      score({ ranked: ["x"], relevant: ["a"] }),
    ]);
    expect(s).toEqual({ cases: 2, hitAt5: 0.5, hitAt8: 0.5, mrr: 0.5, precisionAt5: 0.5 });
  });
});

describe("data/eval/questions.json", () => {
  const cases = EvalSet.parse(JSON.parse(readFileSync(`${root}data/eval/questions.json`, "utf8")));

  it("only expects pages that exist in data/pages", () => {
    const known = new Set<string>();
    for (const file of readdirSync(`${root}data/pages`, { recursive: true, encoding: "utf8" })) {
      if (!file.endsWith(".json")) continue;
      known.add(JSON.parse(readFileSync(`${root}data/pages/${file}`, "utf8")).sourceUrl);
    }
    const missing = cases.flatMap((c) =>
      c.relevant.filter((u) => !known.has(u)).map((u) => `${c.id}: ${u}`),
    );
    expect(missing).toEqual([]);
  });

  it("covers all three languages", () => {
    expect(new Set(cases.map((c) => c.lang))).toEqual(new Set(["sv", "fi", "en"]));
  });
});
