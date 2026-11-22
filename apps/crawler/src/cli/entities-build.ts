/**
 * Build data/entities/places.json (canonical places) and places-review.json (suspected duplicates)
 * from data/gazetteer.json, data/sources/place-merges.json and data/pages.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PageExtraction, PlaceEntity, PlaceMerge, PlaceReview } from "@tuttemuj/schema";
import { z } from "zod";
import { loadConfig } from "../config.ts";
import { resolvePlaces } from "../entities/places.ts";
import { readGazetteerEntries } from "../gazetteer/load.ts";

const config = loadConfig();
const merges = z
  .array(PlaceMerge)
  .parse(JSON.parse(await readFile(join(config.DATA_DIR, "sources", "place-merges.json"), "utf8")));

const dir = join(config.DATA_DIR, "pages");
const pages: PageExtraction[] = [];
for (const file of (await readdir(dir, { recursive: true })).filter((f) => f.endsWith(".json"))) {
  pages.push(PageExtraction.parse(JSON.parse(await readFile(join(dir, file), "utf8"))));
}

const { entities, review } = resolvePlaces(
  await readGazetteerEntries(config.DATA_DIR),
  pages,
  merges,
);
const out = join(config.DATA_DIR, "entities");
await mkdir(out, { recursive: true });
await writeFile(
  join(out, "places.json"),
  `${JSON.stringify(z.array(PlaceEntity).parse(entities), null, 2)}\n`,
);
await writeFile(
  join(out, "places-review.json"),
  `${JSON.stringify(z.array(PlaceReview).parse(review), null, 2)}\n`,
);

const located = entities.filter((e) => e.location).length;
console.log(
  `${entities.length} places (${located} with coordinates), ${review.length} items to review.`,
);
