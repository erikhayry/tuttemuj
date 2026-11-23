import { createClient } from "@supabase/supabase-js";
import { EMBEDDING_MODEL } from "@tuttemuj/schema";
import type { EmbedItem } from "./embed-items.ts";
import { readAll } from "./sync.ts";
import { embed } from "./voyage.ts";

const BATCH = 64;
const keyOf = (kind: string, ref: string) => `${kind}\n${ref}`;

/** What is already embedded with the current model and text, and what is not. */
export const plan = (
  items: EmbedItem[],
  existing: { kind: string; ref: string; text_hash: string }[],
) => {
  const have = new Map(existing.map((e) => [keyOf(e.kind, e.ref), e.text_hash]));
  const wanted = new Set(items.map((i) => keyOf(i.kind, i.ref)));
  return {
    todo: items.filter((i) => have.get(keyOf(i.kind, i.ref)) !== i.hash),
    stale: existing.filter((e) => !wanted.has(keyOf(e.kind, e.ref))),
  };
};

/** Embed what is new or changed, drop what is gone. Resumable: each batch is saved as it finishes. */
export async function embedMissing(
  supabaseUrl: string,
  supabaseKey: string,
  voyageKey: string,
  items: EmbedItem[],
  limit: number,
) {
  const db = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
  const existing = (await readAll(db, "embeddings", "kind,ref,text_hash")) as {
    kind: string;
    ref: string;
    text_hash: string;
  }[];
  const { todo, stale } = plan(items, existing);

  for (const s of stale) {
    const { error } = await db.from("embeddings").delete().eq("kind", s.kind).eq("ref", s.ref);
    if (error) throw new Error(`delete embeddings: ${error.message}`);
  }

  const batch = todo.slice(0, limit);
  let tokens = 0;
  for (let i = 0; i < batch.length; i += BATCH) {
    const part = batch.slice(i, i + BATCH);
    const result = await embed(
      voyageKey,
      part.map((p) => p.text),
      "document",
    );
    tokens += result.tokens;
    const { error } = await db.from("embeddings").upsert(
      part.map((p, n) => ({
        kind: p.kind,
        ref: p.ref,
        page_url: p.pageUrl,
        text_hash: p.hash,
        model: EMBEDDING_MODEL,
        // pgvector reads "[1,2,3]" text.
        embedding: JSON.stringify(result.vectors[n]),
      })),
      { onConflict: "kind,ref" },
    );
    if (error) throw new Error(`upsert embeddings: ${error.message}`);
    console.log(`Embedded ${Math.min(i + BATCH, batch.length)}/${batch.length} (${tokens} tokens)`);
  }
  return {
    embedded: batch.length,
    remaining: todo.length - batch.length,
    removed: stale.length,
    tokens,
  };
}
