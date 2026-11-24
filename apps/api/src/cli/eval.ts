/**
 * Retrieval eval: run every question in data/eval/questions.json through the real retrieval
 * (Voyage search, place-name and proximity boosts) and report how high the right pages rank.
 *
 *   pnpm --filter @tuttemuj/api run eval              # all cases
 *   pnpm --filter @tuttemuj/api run eval -- --lang sv # one language
 *   pnpm --filter @tuttemuj/api run eval -- --verbose # also list the top 8 for each question
 *
 * Needs SUPABASE_URL, SUPABASE_SECRET_KEY and VOYAGE_API_KEY. Question embeddings are cached in
 * .cache/, so only new or changed questions call Voyage. No Claude call is made.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { safeDecode } from "@tuttemuj/schema";
import { Schema } from "effect";
import { type Score, score, summarise } from "../eval.ts";
import { cacheDir, cachedRetrieval, loadCases, readJson } from "./support.ts";

const lastFile = `${cacheDir}/eval-last.json`;
const args = process.argv.slice(2);
const verbose = args.includes("--verbose");
const langArg = args.includes("--lang") ? args[args.indexOf("--lang") + 1] : undefined;

const all = loadCases().filter((c) => langArg === undefined || c.lang === langArg);
// A question nobody has marked a good page for yet cannot be scored.
const cases = all.filter((c) => c.relevant.length > 0);
if (cases.length < all.length) {
  console.log(`Skipping ${all.length - cases.length} questions with no good page marked yet.\n`);
}
const { retrieve } = cachedRetrieval();

const pct = (x: number) => `${Math.round(x * 100)}%`;
const scores: Score[] = [];
for (const c of cases) {
  const { facts } = await retrieve({
    question: c.question,
    lang: c.lang,
    ...(c.lat !== undefined && c.lng !== undefined ? { lat: c.lat, lng: c.lng } : {}),
  });
  const s = score({ ranked: facts.map((f) => f.sourceUrl), relevant: c.relevant });
  scores.push(s);
  const mark = s.hitAt5 ? "✓" : s.hitAt8 ? "~" : "✗";
  console.log(
    `${mark} ${c.id.padEnd(22)} first hit: ${String(s.firstHit ?? "-").padEnd(2)}  precision@5: ${pct(s.precisionAt5)}`,
  );
  if (verbose) {
    const wanted = new Set<string>(c.relevant);
    for (const [i, f] of facts.entries()) {
      console.log(
        `     ${i + 1}. ${wanted.has(f.sourceUrl) ? "●" : "○"} ${f.pageTitle}\n          ${f.sourceUrl}`,
      );
    }
  }
}

const total = summarise(scores);
console.log(
  `\n${total.cases} questions: hit@5 ${pct(total.hitAt5)}, hit@8 ${pct(total.hitAt8)}, ` +
    `MRR ${total.mrr.toFixed(2)}, precision@5 ${pct(total.precisionAt5)}`,
);
console.log("✓ relevant page in the top 5   ~ in the top 8   ✗ not found   ● relevant   ○ other");

const before = safeDecode(
  Schema.Struct({ hitAt5: Schema.Number, mrr: Schema.Number, precisionAt5: Schema.Number }),
)(readJson(lastFile));
if (before.success && langArg === undefined) {
  const d = (now: number, was: number) =>
    `${now >= was ? "+" : ""}${((now - was) * 100).toFixed(1)} pts`;
  console.log(
    `Since the last run: hit@5 ${d(total.hitAt5, before.data.hitAt5)}, ` +
      `MRR ${d(total.mrr, before.data.mrr)}, precision@5 ${d(total.precisionAt5, before.data.precisionAt5)}`,
  );
}
if (langArg === undefined) {
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(lastFile, JSON.stringify(total));
}
