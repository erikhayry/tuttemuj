/** Shared by the eval runner and the review page: the eval file, and retrieval with cached embeddings. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { embed as voyageEmbed } from "@tuttemuj/embeddings";
import { EMBEDDING_MODEL, type EvalCase, EvalSet } from "@tuttemuj/schema";
import { Schema } from "effect";
import { z } from "zod";
import { supabaseRetrieve } from "../retrieve.ts";

export const root = fileURLToPath(new URL("../../../../", import.meta.url));
export const cacheDir = `${root}.cache`;
const casesFile = `${root}data/eval/questions.json`;
const vectorsFile = `${cacheDir}/eval-embeddings.json`;

export const readJson = (file: string): unknown =>
  existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : undefined;

export const loadCases = (): readonly EvalCase[] =>
  Schema.decodeUnknownSync(EvalSet)(readJson(casesFile));

export const saveCases = (cases: readonly EvalCase[]): void => {
  writeFileSync(
    casesFile,
    `${JSON.stringify(Schema.decodeUnknownSync(EvalSet)(cases), null, 2)}\n`,
  );
};

export const env = () =>
  z
    .object({
      SUPABASE_URL: z.url(),
      SUPABASE_SECRET_KEY: z.string().min(20),
      VOYAGE_API_KEY: z.string().min(20),
    })
    .parse(process.env);

/** Real retrieval, but a question asked before takes its embedding from .cache/. */
export function cachedRetrieval() {
  const e = env();
  const vectors = new Map<string, number[]>(
    Object.entries(
      z
        .record(z.string(), z.array(z.number()))
        .catch({})
        .parse(readJson(vectorsFile) ?? {}),
    ),
  );
  const cachedEmbed: typeof voyageEmbed = async (key, texts, inputType) => {
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
  const db = createClient(e.SUPABASE_URL, e.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false },
  });
  return { db, retrieve: supabaseRetrieve(db, e.VOYAGE_API_KEY, cachedEmbed) };
}
