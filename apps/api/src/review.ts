import type { EvalCase } from "@tuttemuj/schema";

export type Verdict = "good" | "bad" | "clear";

/** Mark one page as a good or bad answer to a question, or clear the mark. */
export function judge(
  cases: readonly EvalCase[],
  id: string,
  url: string,
  verdict: Verdict,
): EvalCase[] {
  if (!cases.some((c) => c.id === id)) throw new Error(`no such case: ${id}`);
  return cases.map((c) => {
    if (c.id !== id) return c;
    const without = (list: readonly string[]) => list.filter((u) => u !== url);
    return {
      ...c,
      relevant: verdict === "good" ? [...without(c.relevant), url] : without(c.relevant),
      irrelevant: verdict === "bad" ? [...without(c.irrelevant), url] : without(c.irrelevant),
    };
  });
}

export const verdictOf = (c: EvalCase, url: string): Verdict | undefined =>
  c.relevant.includes(url) ? "good" : c.irrelevant.includes(url) ? "bad" : undefined;

const slug = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");

/** Add a question with nothing judged yet. The id is the question as a slug plus the language. */
export function addCase(
  cases: readonly EvalCase[],
  q: Pick<EvalCase, "question" | "lang" | "lat" | "lng">,
): EvalCase[] {
  const base = `${slug(q.question) || "question"}-${q.lang}`;
  let id = base;
  for (let n = 2; cases.some((c) => c.id === id); n++) id = `${base}-${n}`;
  const { lat, lng } = q;
  return [
    ...cases,
    {
      id,
      question: q.question.trim(),
      lang: q.lang,
      ...(lat !== undefined && lng !== undefined ? { lat, lng } : {}),
      relevant: [],
      irrelevant: [],
    },
  ];
}
