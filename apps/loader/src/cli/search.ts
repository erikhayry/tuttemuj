/**
 * Try the search: embed a question and print the closest pages, events and comic pitches.
 *
 *   pnpm --filter @tuttemuj/loader search:try "Vad hände vid torget?"
 */
import { createClient } from "@supabase/supabase-js";
import { embed } from "@tuttemuj/embeddings";
import { EnvSecret, readEnv, supabaseEnvFields } from "@tuttemuj/schema";
import { Schema } from "effect";

const question = process.argv
  .slice(2)
  .filter((a) => a !== "--")
  .join(" ");
if (!question) throw new Error('Usage: search:try "<question>"');

const env = readEnv(Schema.Struct({ ...supabaseEnvFields, VOYAGE_API_KEY: EnvSecret }));

const { vectors } = await embed(env.VOYAGE_API_KEY, [question], "query");
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const { data, error } = await db.rpc("search_embeddings", {
  in_embedding: JSON.stringify(vectors[0]),
  in_limit: 10,
});
if (error) throw new Error(error.message);
const hits = Schema.decodeUnknownSync(
  Schema.Array(
    Schema.Struct({
      kind: Schema.String,
      ref: Schema.String,
      page_url: Schema.String,
      distance: Schema.Number,
    }),
  ),
)(data);
const { data: pages } = await db
  .from("pages")
  .select("source_url,title")
  .in(
    "source_url",
    hits.map((h) => h.page_url),
  );
const titles = new Map((pages ?? []).map((p) => [p.source_url as string, p.title as string]));
for (const h of hits) {
  console.log(
    `${h.distance.toFixed(3)}  ${h.kind.padEnd(5)} ${titles.get(h.page_url) ?? "?"}\n       ${h.page_url}`,
  );
}
