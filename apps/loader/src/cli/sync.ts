/**
 * Load data/ into Supabase: pages, places, events, the places and people each page mentions, and the v1 facts
 * (page types, uses, relations, image facts).
 *
 *   pnpm --filter @tuttemuj/loader sync            # write to the database
 *   pnpm --filter @tuttemuj/loader sync -- --dry-run   # validate and count only, no network
 *
 * Needs SUPABASE_URL and SUPABASE_SECRET_KEY (in the gitignored .env). Never prints the key.
 */
import { fileURLToPath } from "node:url";
import { readEnv, supabaseEnvFields } from "@tuttemuj/schema";
import { Schema } from "effect";
import { readData } from "../read.ts";
import { buildRows } from "../rows.ts";
import { syncRows } from "../sync.ts";

const dataDir = process.env.DATA_DIR ?? fileURLToPath(new URL("../../../../data", import.meta.url));
const dryRun = process.argv.includes("--dry-run");

const { pages, places, groups } = await readData(dataDir);
const rows = buildRows(pages, places, groups);
const duplicates = rows.pages.filter((p) => p.duplicate_of !== null).length;
console.log(
  `Read ${rows.pages.length} pages (${duplicates} duplicates), ${rows.places.length} places ` +
    `(${rows.places.filter((p) => p.location).length} located), ${rows.pagePlaces.length} page-place links, ` +
    `${rows.events.length} events (${rows.eventPlaces.length} event-place links), ${rows.pagePeople.length} page-person rows, ` +
    `${rows.placeUses.length} place uses, ${rows.relations.length} person-place relations, ` +
    `${rows.imageFacts.length} image facts (${rows.imageFactPlaces.length} image-place links).`,
);

if (dryRun) {
  console.log("Dry run: nothing written.");
} else {
  const env = readEnv(Schema.Struct(supabaseEnvFields));
  const result = await syncRows(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, rows);
  console.log("Upserted:", result.upserted);
  console.log("Removed:", result.removed);
}
