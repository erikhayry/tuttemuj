import {
  type AskRequest,
  AskResponse,
  type AskSource,
  type Lang,
  SourceUrl,
} from "@tuttemuj/schema";
import { z } from "zod";
import { buildPrompt, type Fact, type Nearby } from "./facts.ts";

/** What retrieval found for a question, best first. */
export type Retrieved = { facts: Fact[]; nearby: Nearby | undefined };
export type Retrieve = (req: AskRequest) => Promise<Retrieved>;

/** What Claude must return. */
export const Draft = z.object({
  answerable: z.boolean(),
  answer: z.string(),
  /** Numbers of the facts the answer cites. */
  used: z.array(z.int()),
});
export type Draft = z.infer<typeof Draft>;
export type Answer = (prompt: string) => Promise<Draft>;

const NO_FACTS: Record<Lang, string> = {
  sv: "Jag hittar inget om det här på nykarlebyvyer.nu.",
  fi: "En löydä tästä mitään sivustolta nykarlebyvyer.nu.",
  en: "I can't find anything about this on nykarlebyvyer.nu.",
};

const SUGGESTIONS = 3;

const toSuggestions = (facts: Fact[]) =>
  facts
    .slice(0, SUGGESTIONS)
    .map((f) => ({ sourceUrl: SourceUrl.parse(f.sourceUrl), title: f.pageTitle }));

/**
 * Answer a question from retrieved facts only. The answer is grounded when Claude says the facts
 * answer it and cites at least one real fact. Otherwise the nearest pages are suggested.
 */
export async function ask(
  retrieve: Retrieve,
  answer: Answer,
  req: AskRequest,
): Promise<AskResponse> {
  const { facts, nearby } = await retrieve(req);
  if (facts.length === 0) {
    return { answer: NO_FACTS[req.lang], grounded: false, sources: [], suggestions: [] };
  }

  const draft = Draft.parse(await answer(buildPrompt(req.question, req.lang, facts, nearby)));

  // Only real facts count as citations, each once, in the order they appear.
  const cited = [...new Set(draft.used)]
    .filter((n) => n >= 1 && n <= facts.length)
    .sort((a, b) => a - b);
  if (!draft.answerable || cited.length === 0) {
    const text = draft.answer.trim() || NO_FACTS[req.lang];
    return { answer: text, grounded: false, sources: [], suggestions: toSuggestions(facts) };
  }

  const sources: AskSource[] = cited.map((n) => ({
    n,
    sourceUrl: SourceUrl.parse((facts[n - 1] as Fact).sourceUrl),
    title: (facts[n - 1] as Fact).pageTitle,
  }));
  return AskResponse.parse({ answer: draft.answer, grounded: true, sources, suggestions: [] });
}
