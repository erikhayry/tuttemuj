/**
 * Build data/entities/page-groups.json: pages that repeat each other (Swedish/English caption pairs,
 * enlargements). Uses data/frontier.jsonl for images and data/pages for titles and fact counts.
 * No requests to the site.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PageExtraction, PageGroup, SOURCE_ORIGIN } from "@tuttemuj/schema";
import { Schema } from "effect";
import { loadConfig } from "../config.ts";
import { Frontier } from "../frontier.ts";
import { groupDuplicatePages, type PageInfo } from "../pages/groups.ts";

const config = loadConfig();
const frontier = await Frontier.load(join(config.DATA_DIR, "frontier.jsonl"));

const extracted = new Map<string, PageExtraction>();
const dir = join(config.DATA_DIR, "pages");
for (const file of (await readdir(dir, { recursive: true })).filter((f) => f.endsWith(".json"))) {
  const page = Schema.decodeUnknownSync(PageExtraction)(
    JSON.parse(await readFile(join(dir, file), "utf8")),
  );
  extracted.set(page.sourceUrl, page);
}

const infos: PageInfo[] = [];
for (const entry of frontier.byPriority("fetched")) {
  const page = extracted.get(entry.url);
  infos.push({
    path: entry.url.slice(SOURCE_ORIGIN.length + 1),
    title: page?.title,
    images: (entry.images ?? []).flatMap((i) => (i.fullUrl ? [i.url, i.fullUrl] : [i.url])),
    facts: page ? page.people.length + page.places.length + page.events.length : 0,
  });
}

const groups = groupDuplicatePages(infos);
const out = join(config.DATA_DIR, "entities");
await mkdir(out, { recursive: true });
await writeFile(
  join(out, "page-groups.json"),
  `${JSON.stringify(Schema.decodeUnknownSync(Schema.Array(PageGroup))(groups), null, 2)}\n`,
);
const dups = groups.reduce((n, g) => n + g.duplicates.length, 0);
console.log(`${groups.length} groups, ${dups} duplicate pages (of ${infos.length} fetched).`);
