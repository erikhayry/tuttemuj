/**
 * Set `pageType` to "empty" or "menu" on extracted pages whose own summary says they have no content
 * and that have no facts (see `noContentPageType`). Offline and safe to re-run: pages that already
 * have a `pageType` are left alone. `extract:save` does the same for new pages.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { noContentPageType, PageExtraction } from "@tuttemuj/schema";
import { Schema } from "effect";
import { loadConfig } from "../config.ts";

const config = loadConfig();
const dir = join(config.DATA_DIR, "pages");
const counts = { empty: 0, menu: 0 };
for (const file of (await readdir(dir, { recursive: true })).filter((f) => f.endsWith(".json"))) {
  const path = join(dir, file);
  // Edit the raw JSON so the file keeps its exact shape; decoding only checks it.
  const raw = JSON.parse(await readFile(path, "utf8"));
  const page = Schema.decodeUnknownSync(PageExtraction)(raw);
  if (page.pageType !== undefined) continue;
  const pageType = noContentPageType(page);
  if (!pageType) continue;
  raw.pageType = pageType;
  Schema.decodeUnknownSync(PageExtraction)(raw);
  await writeFile(path, `${JSON.stringify(raw, null, 2)}\n`);
  counts[pageType]++;
}
console.log(`Marked ${counts.empty} empty pages and ${counts.menu} menus.`);
