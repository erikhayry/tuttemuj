import type { EvalCase } from "@tuttemuj/schema";
import { describe, expect, it } from "vitest";
import { addCase, judge, verdictOf } from "./review.ts";

const url = (n: string) => `https://www.nykarlebyvyer.nu/sidor/${n}.html`;
const base: EvalCase = {
  id: "q-sv",
  question: "Vad hände vid bron?",
  lang: "sv",
  relevant: [url("a")],
  irrelevant: [],
};

describe("judge", () => {
  it("marks a page good or bad and moves it between the lists", () => {
    const bad = judge([base], "q-sv", url("a"), "bad")[0] as EvalCase;
    expect(bad.relevant).toEqual([]);
    expect(bad.irrelevant).toEqual([url("a")]);
    const good = judge([bad], "q-sv", url("a"), "good")[0] as EvalCase;
    expect(good.relevant).toEqual([url("a")]);
    expect(good.irrelevant).toEqual([]);
  });

  it("clears a mark, and never lists a page twice", () => {
    const twice = judge(
      judge([base], "q-sv", url("b"), "good"),
      "q-sv",
      url("b"),
      "good",
    )[0] as EvalCase;
    expect(twice.relevant).toEqual([url("a"), url("b")]);
    const cleared = judge([twice], "q-sv", url("b"), "clear")[0] as EvalCase;
    expect(cleared.relevant).toEqual([url("a")]);
    expect(verdictOf(cleared, url("b"))).toBeUndefined();
  });

  it("leaves other cases alone and rejects an unknown case", () => {
    const other = { ...base, id: "other-sv" };
    expect(judge([base, other], "q-sv", url("z"), "bad")[1]).toEqual(other);
    expect(() => judge([base], "nope", url("a"), "good")).toThrow("no such case");
  });
});

describe("addCase", () => {
  it("adds an unjudged case with an id made from the question", () => {
    const [, added] = addCase([base], { question: " Vem bodde i Åminne? ", lang: "sv" });
    expect(added).toEqual({
      id: "vem-bodde-i-aminne-sv",
      question: "Vem bodde i Åminne?",
      lang: "sv",
      relevant: [],
      irrelevant: [],
    });
  });

  it("keeps ids unique and stores a location when both coordinates are given", () => {
    const once = addCase([base], {
      question: "Vad hände vid bron?",
      lang: "sv",
      lat: 63.5,
      lng: 22.5,
    });
    const twice = addCase(once, { question: "Vad hände vid bron?", lang: "sv" });
    expect(twice.map((c) => c.id)).toEqual([
      "q-sv",
      "vad-hande-vid-bron-sv",
      "vad-hande-vid-bron-sv-2",
    ]);
    expect(once[1]).toMatchObject({ lat: 63.5, lng: 22.5 });
    expect(twice[2]).not.toHaveProperty("lat");
  });
});
