import {
  type AskRequest,
  AskResponse,
  type AskSource,
  type Lang,
  SourceUrl,
} from "@tuttemuj/schema";
import { Schema } from "effect";
import { buildPrompt, type Fact, type Nearby } from "./facts.ts";

/** What retrieval found for a question, best first. */
export type Retrieved = { facts: Fact[]; nearby: Nearby | undefined };
export type Retrieve = (req: AskRequest) => Promise<Retrieved>;

/** What Claude must return. */
export const Draft = Schema.Struct({
  answerable: Schema.Boolean,
  answer: Schema.String,
  /** Numbers of the facts the answer cites. */
  used: Schema.Array(Schema.Int),
});
export type Draft = typeof Draft.Type;
export type Answer = (prompt: string) => Promise<Draft>;

const NO_FACTS: Record<Lang, string> = {
  sv: "Jag hittar inget om det här på nykarlebyvyer.nu.",
  fi: "En löydä tästä mitään sivustolta nykarlebyvyer.nu.",
  en: "I can't find anything about this on nykarlebyvyer.nu.",
};

const SEARCH_INTRO: Record<Lang, string> = {
  sv: "Det här är sidorna på nykarlebyvyer.nu som bäst matchar din fråga:",
  fi: "Nämä nykarlebyvyer.nu-sivuston sivut vastaavat parhaiten kysymystäsi:",
  en: "These pages on nykarlebyvyer.nu match your question best:",
};

const SUGGESTIONS = 3;
const SEARCH_RESULTS = 5;

const toSuggestions = (facts: Fact[]) =>
  facts.slice(0, SUGGESTIONS).map((f) => ({
    sourceUrl: Schema.decodeUnknownSync(SourceUrl)(f.sourceUrl),
    title: f.pageTitle,
  }));

/**
 * Search mode, without Claude: the best matching pages with our own summaries and the links.
 * Costs nothing beyond the Voyage search.
 */
const searchOnly = (req: AskRequest, facts: Fact[]): AskResponse =>
  Schema.decodeUnknownSync(AskResponse)({
    mode: "search",
    answer: SEARCH_INTRO[req.lang],
    grounded: true,
    sources: facts.slice(0, SEARCH_RESULTS).map((f, i) => ({
      n: i + 1,
      sourceUrl: f.sourceUrl,
      title: f.pageTitle,
      summary: f.summary,
      ...(f.people.length > 0 ? { people: f.people } : {}),
    })),
    suggestions: [],
  });

/**
 * Answer a question from retrieved facts only. Without `answer` (no Claude key) it lists the best
 * matching pages instead. The answer is grounded when Claude says the facts
 * answer it and cites at least one real fact. Otherwise the nearest pages are suggested.
 */
export async function ask(
  retrieve: Retrieve,
  answer: Answer | undefined,
  req: AskRequest,
): Promise<AskResponse> {
  const { facts, nearby } = await retrieve(req);
  if (facts.length === 0) {
    return {
      mode: answer ? "answer" : "search",
      answer: NO_FACTS[req.lang],
      grounded: false,
      sources: [],
      suggestions: [],
    };
  }
  if (!answer) return searchOnly(req, facts);

  const draft = Schema.decodeUnknownSync(Draft)(
    await answer(buildPrompt(req.question, req.lang, facts, nearby)),
  );

  // Only real facts count as citations, each once, in the order they appear.
  const cited = [...new Set(draft.used)]
    .filter((n) => n >= 1 && n <= facts.length)
    .sort((a, b) => a - b);
  if (!draft.answerable || cited.length === 0) {
    const text = draft.answer.trim() || NO_FACTS[req.lang];
    return {
      mode: "answer",
      answer: text,
      grounded: false,
      sources: [],
      suggestions: toSuggestions(facts),
    };
  }

  const sources: AskSource[] = cited.map((n) => ({
    n,
    sourceUrl: Schema.decodeUnknownSync(SourceUrl)((facts[n - 1] as Fact).sourceUrl),
    title: (facts[n - 1] as Fact).pageTitle,
  }));
  return Schema.decodeUnknownSync(AskResponse)({
    mode: "answer",
    answer: draft.answer,
    grounded: true,
    sources,
    suggestions: [],
  });
}
