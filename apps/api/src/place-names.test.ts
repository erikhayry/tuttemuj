import { describe, expect, it } from "vitest";
import { buildPlaceNameIndex, findPlaceIds, nameBonus } from "./place-names.ts";

const index = buildPlaceNameIndex([
  { id: "forsby", name: "Forsby", aliases: [] },
  { id: "torget", name: "Torget", aliases: ["marknadstorget"] },
  { id: "kyrkan", name: "kyrkan", aliases: [] },
  { id: "gamla-kyrkan", name: "Gamla kyrkan", aliases: [] },
  { id: "bro", name: "bro", aliases: [] },
]);

describe("findPlaceIds", () => {
  it("finds a place named in a question, ignoring case and punctuation", () => {
    expect(findPlaceIds("Vem bodde i Forsby?", index)).toEqual(["forsby"]);
  });

  it("finds aliases", () => {
    expect(findPlaceIds("Vad hände på marknadstorget?", index)).toEqual(["torget"]);
  });

  it("prefers the longest name and does not match its words again", () => {
    expect(findPlaceIds("När byggdes Gamla kyrkan?", index)).toEqual(["gamla-kyrkan"]);
  });

  it("ignores names under four letters, which are mostly ordinary words", () => {
    expect(findPlaceIds("Var finns en bro?", index)).toEqual([]);
  });

  it("returns nothing when no place is named", () => {
    expect(findPlaceIds("Vem var rådman?", index)).toEqual([]);
  });
});

describe("nameBonus", () => {
  it("is full for a place on few pages and shrinks for a place on many", () => {
    expect(nameBonus(5)).toBeCloseTo(0.12);
    expect(nameBonus(20)).toBeCloseTo(0.12);
    expect(nameBonus(133)).toBeLessThan(0.02);
  });
});
