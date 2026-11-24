/**
 * Embed page summaries, events and comic pitches with Voyage, into the `embeddings` table.
 * Run `sync` first (embeddings point at pages).
 *
 *   pnpm --filter @tuttemuj/loader embed -- --dry-run   # count what would be embedded
 *   pnpm --filter @tuttemuj/loader embed -- --limit 200 # try a few first
 *   pnpm --filter @tuttemuj/loader embed                # everything that is new or changed
 *
 * Needs SUPABASE_URL, SUPABASE_SECRET_KEY and VOYAGE_API_KEY (gitignored .env). Never prints keys.
 */
import { fileURLToPath } from "node:url";
import { EnvSecret, readEnv, supabaseEnvFields } from "@tuttemuj/schema";
import { Schema } from "effect";
import { embedItems, isNavigationPage } from "../embed-items.ts";
import { embedMissing } from "../embed-sync.ts";
import { readData } from "../read.ts";
import { buildRows } from "../rows.ts";

const dataDir = process.env.DATA_DIR ?? fileURLToPath(new URL("../../../../data", import.meta.url));
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitAt = args.indexOf("--limit");
const limit =
  limitAt >= 0
    ? Schema.decodeUnknownSync(
        Schema.FiniteFromString.check(Schema.isInt(), Schema.isGreaterThan(0)),
      )(args[limitAt + 1])
    : Infinity;

const { pages, places, groups } = await readData(dataDir);
const skipped = new Set(pages.filter(isNavigationPage).map((p) => p.sourceUrl));
const items = embedItems(buildRows(pages, places, groups), skipped);
const count = (kind: string) => items.filter((i) => i.kind === kind).length;
const chars = items.reduce((n, i) => n + i.text.length, 0);
console.log(`Leaving out ${skipped.size} empty and navigation pages.`);
console.log(
  `${items.length} items (${count("page")} pages, ${count("event")} events, ${count("comic")} comic pitches), ` +
    `about ${Math.round(chars / 3.5 / 1000)}k tokens.`,
);

if (dryRun) {
  console.log("Dry run: nothing sent.");
} else {
  const env = readEnv(Schema.Struct({ ...supabaseEnvFields, VOYAGE_API_KEY: EnvSecret }));
  console.log(
    await embedMissing(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, env.VOYAGE_API_KEY, items, limit),
  );
}
