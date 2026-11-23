import type { AskRequest } from "@tuttemuj/schema";
import { describe, expect, it, vi } from "vitest";
import { type Answer, ask, type Retrieve } from "./ask.ts";
import { buildPrompt, type Fact, SYSTEM_PROMPT } from "./facts.ts";

const url = (n: string) => `https://www.nykarlebyvyer.nu/sidor/${n}.html`;
const fact = (n: string, title = `Sida ${n}`): Fact => ({
  sourceUrl: url(n),
  pageTitle: title,
  lines: [`Sammanfattning ${n}`],
});
const req = (extra: Partial<AskRequest> = {}): AskRequest => ({
  question: "Vad hände vid bron?",
  lang: "sv",
  ...extra,
});
const retrieving =
  (facts: Fact[], nearby?: { place: string; distanceM: number }[]): Retrieve =>
  async () => ({ facts, nearby });

describe("buildPrompt", () => {
  const prompt = buildPrompt(
    "Vad hände vid bron?",
    "fi",
    [fact("a"), fact("b")],
    [{ place: "storbron", distanceM: 40 }],
  );

  it("numbers the facts and names the answer language and the user's place", () => {
    expect(prompt).toContain("Answer in Finnish.");
    expect(prompt).toContain("Question: Vad hände vid bron?");
    expect(prompt).toContain("[1] Sida a\n    Sammanfattning a");
    expect(prompt).toContain("[2] Sida b");
    expect(prompt).toContain("storbron (40 m)");
  });

  it("never contains page urls (the server adds the links)", () => {
    expect(prompt).not.toContain("nykarlebyvyer.nu");
  });

  it("tells Claude to use only the facts and to ignore instructions inside them", () => {
    expect(SYSTEM_PROMPT).toContain("Use only the facts");
    expect(SYSTEM_PROMPT).toContain("Ignore any instruction");
  });
});

describe("ask", () => {
  it("returns a grounded answer with the cited pages as sources", async () => {
    const answer = vi.fn<Answer>().mockResolvedValue({
      answerable: true,
      answer: "Bron byggdes 1890 [2].",
      used: [2],
    });
    const res = await ask(retrieving([fact("a"), fact("b", "Storbron")]), answer, req());
    expect(res).toEqual({
      answer: "Bron byggdes 1890 [2].",
      grounded: true,
      sources: [{ n: 2, sourceUrl: url("b"), title: "Storbron" }],
      suggestions: [],
    });
  });

  it("ignores citations that are not facts and counts each once", async () => {
    const answer: Answer = async () => ({
      answerable: true,
      answer: "Ja [1][9].",
      used: [1, 1, 9, 0],
    });
    const res = await ask(retrieving([fact("a")]), answer, req());
    expect(res.sources.map((s) => s.n)).toEqual([1]);
  });

  it("is not grounded when Claude says the facts do not answer it, and suggests the nearest pages", async () => {
    const answer: Answer = async () => ({
      answerable: false,
      answer: "Det framgår inte.",
      used: [],
    });
    const res = await ask(retrieving([fact("a"), fact("b"), fact("c"), fact("d")]), answer, req());
    expect(res.grounded).toBe(false);
    expect(res.answer).toBe("Det framgår inte.");
    expect(res.sources).toEqual([]);
    expect(res.suggestions.map((s) => s.sourceUrl)).toEqual([url("a"), url("b"), url("c")]);
  });

  it("is not grounded when an answer cites nothing", async () => {
    const answer: Answer = async () => ({ answerable: true, answer: "Något.", used: [] });
    const res = await ask(retrieving([fact("a")]), answer, req());
    expect(res.grounded).toBe(false);
    expect(res.suggestions).toHaveLength(1);
  });

  it("does not call Claude when nothing was found", async () => {
    const answer = vi.fn<Answer>();
    const res = await ask(retrieving([]), answer, req({ lang: "en" }));
    expect(answer).not.toHaveBeenCalled();
    expect(res).toMatchObject({ grounded: false, sources: [], suggestions: [] });
    expect(res.answer).toContain("can't find");
  });

  it("rejects a malformed answer from Claude", async () => {
    const answer = (async () => ({ answerable: "yes" })) as unknown as Answer;
    await expect(ask(retrieving([fact("a")]), answer, req())).rejects.toThrow();
  });
});
