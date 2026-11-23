/**
 * Load data/ into Supabase: pages, places and which pages mention which places.
 *
 *   pnpm --filter @tuttemuj/loader sync            # write to the database
 *   pnpm --filter @tuttemuj/loader sync -- --dry-run   # validate and count only, no network
 *
 * Needs SUPABASE_URL and SUPABASE_SECRET_KEY (in the gitignored .env). Never prints the key.
 */
import { fileURLToPath } from "node:url";
import { z } from "zod";
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
    `(${rows.places.filter((p) => p.location).length} located), ${rows.pagePlaces.length} page-place links.`,
);

if (dryRun) {
  console.log("Dry run: nothing written.");
} else {
  const env = z
    .object({
      SUPABASE_URL: z.url(),
      SUPABASE_SECRET_KEY: z.string().min(20),
    })
    .parse(process.env);
  const result = await syncRows(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, rows);
  console.log("Upserted:", result.upserted);
  console.log("Removed:", result.removed);
}
