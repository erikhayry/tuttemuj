/**
 * List places in data/pages that have no coordinates and none of whose names is in the gazetteer
 * (neither located nor waiting for coordinates), skipping data/sources/ignored-places.json.
 * Candidates for data/sources/manual-places.json.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { IgnoredPlace, PageExtraction } from "@tuttemuj/schema";
import { z } from "zod";
import { loadConfig } from "../config.ts";
import { normalizeName } from "../gazetteer/build.ts";
import { readGazetteerEntries } from "../gazetteer/load.ts";

const config = loadConfig();
const known = new Set<string>();
for (const e of await readGazetteerEntries(config.DATA_DIR)) {
  for (const name of [e.name, ...(e.alternateNames ?? [])]) known.add(normalizeName(name));
}

const ignored = z
  .array(IgnoredPlace)
  .parse(
    JSON.parse(await readFile(join(config.DATA_DIR, "sources", "ignored-places.json"), "utf8")),
  );
for (const { name } of ignored) known.add(normalizeName(name));

type Candidate = { name: string; kind: string; alternateNames: string[]; pages: string[] };
const candidates = new Map<string, Candidate>();
const dir = join(config.DATA_DIR, "pages");
for (const file of (await readdir(dir, { recursive: true })).filter((f) => f.endsWith(".json"))) {
  const page = PageExtraction.parse(JSON.parse(await readFile(join(dir, file), "utf8")));
  for (const place of page.places) {
    const names = [place.name, ...place.alternateNames].map(normalizeName);
    if (place.geo || names.some((n) => known.has(n))) continue;
    const key = normalizeName(place.name);
    const c = candidates.get(key) ?? { name: key, kind: place.kind, alternateNames: [], pages: [] };
    for (const alt of place.alternateNames.map(normalizeName)) {
      if (alt !== key && !c.alternateNames.includes(alt)) c.alternateNames.push(alt);
    }
    c.pages.push(page.sourceUrl.replace(/^https:\/\/www\.nykarlebyvyer\.nu\//, ""));
    candidates.set(key, c);
  }
}
const rows = [...candidates.values()].sort((a, b) => a.name.localeCompare(b.name, "sv"));
console.log(JSON.stringify(rows, null, 2));
console.error(`${rows.length} place names not in the gazetteer.`);
