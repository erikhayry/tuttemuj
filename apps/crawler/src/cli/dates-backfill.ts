/**
 * Set `endYear` on existing event dates whose own wording states a span ("1873–1971", "på 1830-talet").
 * Reads only data/pages; never touches the site. Dates that already have an endYear are kept.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PageExtraction } from "@tuttemuj/schema";
import { Schema } from "effect";
import { loadConfig } from "../config.ts";
import { inferEndYear } from "../dates/end-year.ts";

const config = loadConfig();
const dir = join(config.DATA_DIR, "pages");
let pages = 0;
let dates = 0;
for (const file of (await readdir(dir, { recursive: true })).filter((f) => f.endsWith(".json"))) {
  const path = join(dir, file);
  // Edit the raw JSON (decoded data is readonly), and validate it again before writing.
  const raw = JSON.parse(await readFile(path, "utf8"));
  const page = Schema.decodeUnknownSync(PageExtraction)(raw);
  let changed = false;
  for (const [i, event] of page.events.entries()) {
    if (!event.date || event.date.endYear !== undefined) continue;
    const endYear = inferEndYear(event.date);
    if (endYear === undefined) continue;
    raw.events[i].date.endYear = endYear;
    dates++;
    changed = true;
  }
  if (changed) {
    pages++;
    await writeFile(
      path,
      `${JSON.stringify(Schema.decodeUnknownSync(PageExtraction)(raw), null, 2)}\n`,
    );
  }
}
console.log(`Set endYear on ${dates} dates on ${pages} pages.`);
