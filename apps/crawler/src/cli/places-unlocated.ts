/**
 * Rank gazetteer entries that still have no coordinates by the number of analysed pages that
 * mention them. The top of the list is what to locate first in data/sources/manual-places.json.
 *
 * Usage: pnpm --filter @tuttemuj/crawler places:unlocated [limit=100] [--json]
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { PageExtraction } from "@tuttemuj/schema";
import { Schema } from "effect";
import { loadConfig } from "../config.ts";
import { readGazetteerEntries } from "../gazetteer/load.ts";
import { rankUnlocated } from "../gazetteer/unlocated.ts";

const args = process.argv.slice(2);
const json = args.includes("--json");
const limit = Number(args.find((a) => /^\d+$/.test(a)) ?? 100);

const config = loadConfig();
const dir = join(config.DATA_DIR, "pages");
const pages: PageExtraction[] = [];
for (const file of (await readdir(dir, { recursive: true })).filter((f) => f.endsWith(".json"))) {
  pages.push(
    Schema.decodeUnknownSync(PageExtraction)(JSON.parse(await readFile(join(dir, file), "utf8"))),
  );
}
const all = rankUnlocated(await readGazetteerEntries(config.DATA_DIR), pages);
const rows = all.slice(0, limit);

if (json) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  for (const r of rows) console.log(`${String(r.pageCount).padStart(4)}  ${r.name}  [${r.kind}]`);
}
console.error(`${all.length} unlocated places mentioned on pages; showing ${rows.length}.`);
