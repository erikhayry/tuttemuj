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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import type { embed } from "@tuttemuj/embeddings";
import { embed as voyageEmbed } from "@tuttemuj/embeddings";
import { EMBEDDING_MODEL, EvalSet } from "@tuttemuj/schema";
import { z } from "zod";
import { type Score, score, summarise } from "../eval.ts";
import { supabaseRetrieve } from "../retrieve.ts";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const cacheDir = `${root}.cache`;
const vectorsFile = `${cacheDir}/eval-embeddings.json`;
const lastFile = `${cacheDir}/eval-last.json`;

const env = z
  .object({
    SUPABASE_URL: z.url(),
    SUPABASE_SECRET_KEY: z.string().min(20),
    VOYAGE_API_KEY: z.string().min(20),
  })
  .parse(process.env);

const args = process.argv.slice(2);
const verbose = args.includes("--verbose");
const langArg = args.includes("--lang") ? args[args.indexOf("--lang") + 1] : undefined;

const cases = EvalSet.parse(
  JSON.parse(readFileSync(`${root}data/eval/questions.json`, "utf8")),
).filter((c) => langArg === undefined || c.lang === langArg);

const readJson = (file: string): unknown =>
  existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : undefined;
const vectors = new Map<string, number[]>(
  Object.entries(z.record(z.string(), z.array(z.number())).catch({}).parse(readJson(vectorsFile))),
);

/** Voyage, but a question asked before comes from the cache. */
const cachedEmbed: typeof embed = async (key, texts, inputType) => {
  const cacheKey = `${EMBEDDING_MODEL}|${texts[0]}`;
  const hit = vectors.get(cacheKey);
  if (hit && texts.length === 1) return { vectors: [hit], tokens: 0 };
  const result = await voyageEmbed(key, texts, inputType);
  if (texts.length === 1 && result.vectors[0]) {
    vectors.set(cacheKey, result.vectors[0]);
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(vectorsFile, JSON.stringify(Object.fromEntries(vectors)));
  }
  return result;
};

const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const retrieve = supabaseRetrieve(db, env.VOYAGE_API_KEY, cachedEmbed);

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
      console.log(`     ${i + 1}. ${wanted.has(f.sourceUrl) ? "●" : "○"} ${f.pageTitle}`);
    }
  }
}

const total = summarise(scores);
console.log(
  `\n${total.cases} questions: hit@5 ${pct(total.hitAt5)}, hit@8 ${pct(total.hitAt8)}, ` +
    `MRR ${total.mrr.toFixed(2)}, precision@5 ${pct(total.precisionAt5)}`,
);
console.log("✓ relevant page in the top 5   ~ in the top 8   ✗ not found   ● relevant   ○ other");

const before = z
  .object({ hitAt5: z.number(), mrr: z.number(), precisionAt5: z.number() })
  .safeParse(readJson(lastFile));
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
