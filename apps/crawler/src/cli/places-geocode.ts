/** Re-run geocoding for every page in data/pages, e.g. after the gazetteer changed. */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PageExtraction } from "@tuttemuj/schema";
import { loadConfig } from "../config.ts";
import { loadGazetteer } from "../gazetteer/load.ts";

const config = loadConfig();
const gazetteer = await loadGazetteer(config.DATA_DIR);
if (!gazetteer) {
  console.error("No data/gazetteer.json. Run `pnpm --filter @tuttemuj/crawler gazetteer:build`.");
  process.exit(1);
}

const dir = join(config.DATA_DIR, "pages");
const files = (await readdir(dir, { recursive: true })).filter((f) => f.endsWith(".json"));
let places = 0;
let located = 0;
for (const file of files) {
  const path = join(dir, file);
  const page = gazetteer.geocodePage(
    PageExtraction.parse(JSON.parse(await readFile(path, "utf8"))),
  );
  places += page.places.length;
  located += page.places.filter((p) => p.geo).length;
  await writeFile(path, `${JSON.stringify(page, null, 2)}\n`);
}
console.log(`Geocoded ${files.length} pages: ${located} of ${places} places located.`);
