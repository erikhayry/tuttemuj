/**
 * Try the search: embed a question and print the closest pages, events and comic pitches.
 *
 *   pnpm --filter @tuttemuj/loader search "Vad hände vid torget?"
 */
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { embed } from "../voyage.ts";

const question = process.argv
  .slice(2)
  .filter((a) => a !== "--")
  .join(" ");
if (!question) throw new Error('Usage: search "<question>"');

const env = z
  .object({
    SUPABASE_URL: z.url(),
    SUPABASE_SECRET_KEY: z.string().min(20),
    VOYAGE_API_KEY: z.string().min(20),
  })
  .parse(process.env);

const { vectors } = await embed(env.VOYAGE_API_KEY, [question], "query");
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const { data, error } = await db.rpc("search_embeddings", {
  in_embedding: JSON.stringify(vectors[0]),
  in_limit: 10,
});
if (error) throw new Error(error.message);
const hits = z
  .array(
    z.object({ kind: z.string(), ref: z.string(), page_url: z.string(), distance: z.number() }),
  )
  .parse(data);
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
