/** Scoring for the retrieval eval: how high do the pages that answer a question rank? */

export type CaseResult = {
  /** Source urls returned, best first. */
  ranked: string[];
  relevant: readonly string[];
};

export type Score = {
  /** Rank (1-based) of the first relevant page, or undefined when none was returned. */
  firstHit: number | undefined;
  hitAt5: boolean;
  hitAt8: boolean;
  /** 1 / rank of the first relevant page, 0 when none. */
  reciprocalRank: number;
  /** Share of the top 5 that is relevant, out of the most the list could hold. */
  precisionAt5: number;
};

export function score({ ranked, relevant }: CaseResult): Score {
  const wanted = new Set(relevant);
  const index = ranked.findIndex((url) => wanted.has(url));
  const firstHit = index === -1 ? undefined : index + 1;
  const top5 = ranked.slice(0, 5);
  const possible = Math.min(5, wanted.size);
  return {
    firstHit,
    hitAt5: firstHit !== undefined && firstHit <= 5,
    hitAt8: firstHit !== undefined && firstHit <= 8,
    reciprocalRank: firstHit === undefined ? 0 : 1 / firstHit,
    precisionAt5: top5.filter((url) => wanted.has(url)).length / possible,
  };
}

const mean = (xs: number[]): number =>
  xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

export type Summary = {
  cases: number;
  hitAt5: number;
  hitAt8: number;
  mrr: number;
  precisionAt5: number;
};

/** Averages over cases, each as a share between 0 and 1. */
export function summarise(scores: Score[]): Summary {
  return {
    cases: scores.length,
    hitAt5: mean(scores.map((s) => Number(s.hitAt5))),
    hitAt8: mean(scores.map((s) => Number(s.hitAt8))),
    mrr: mean(scores.map((s) => s.reciprocalRank)),
    precisionAt5: mean(scores.map((s) => s.precisionAt5)),
  };
}
