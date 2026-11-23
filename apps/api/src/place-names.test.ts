import { describe, expect, it } from "vitest";
import { baseForms, buildPlaceNameIndex, findPlaceIds, nameBonus } from "./place-names.ts";

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

describe("inflected place names", () => {
  const places = buildPlaceNameIndex([
    ...[
      { id: "forsby", name: "Forsby", aliases: [] },
      { id: "kuddnas", name: "Kuddnäs", aliases: [] },
      { id: "storbron", name: "Storbron", aliases: [] },
      { id: "gamla-kyrkan", name: "Gamla kyrkan", aliases: [] },
    ],
  ]);

  it.each([
    ["Kuka asui Forsbyssä?", "forsby"],
    ["Mistä Forsbystä tulee tämä?", "forsby"],
    ["Kuka asui Kuddnäsissä?", "kuddnas"],
    ["Mitä tapahtui Storbronilla?", "storbron"],
    ["Mitä tapahtui Storbronin lähellä?", "storbron"],
    ["Vem bodde på Forsbys gårdar?", "forsby"],
  ])("finds the place in %s", (question, id) => {
    expect(findPlaceIds(question, places)).toEqual([id]);
  });

  it("inflects only the last word of a longer name", () => {
    expect(findPlaceIds("Mitä tapahtui Gamla kyrkanissa?", places)).toEqual(["gamla-kyrkan"]);
  });

  it("does not match short stems or unrelated words", () => {
    expect(findPlaceIds("Kuka oli kaupungissa?", places)).toEqual([]);
    expect(baseForms("bron")).toEqual(["bron"]);
  });

  it("lists the word itself first, so a name written as is always wins", () => {
    expect(baseForms("kuddnäs")[0]).toBe("kuddnäs");
    expect(baseForms("kuddnäsissä")).toEqual(
      expect.arrayContaining(["kuddnäsissä", "kuddnäsi", "kuddnäs"]),
    );
  });
});

describe("nameBonus", () => {
  it("is full for a place on few pages and shrinks for a place on many", () => {
    expect(nameBonus(5)).toBeCloseTo(0.12);
    expect(nameBonus(20)).toBeCloseTo(0.12);
    expect(nameBonus(133)).toBeLessThan(0.02);
  });
});
