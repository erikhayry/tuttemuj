/** Build data/gazetteer.json from data/sources/nkby-2018 and data/sources/manual-places.json. */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ManualPlace, Nkby2018 } from "@tuttemuj/schema";
import { z } from "zod";
import { loadConfig } from "../config.ts";
import { buildGazetteer } from "../gazetteer/build.ts";
import { gazetteerPath } from "../gazetteer/load.ts";

const config = loadConfig();
const dir = join(config.DATA_DIR, "sources", "nkby-2018");
const read = async (file: string) => JSON.parse(await readFile(join(dir, file), "utf8"));

const manual = z
  .array(ManualPlace)
  .parse(
    JSON.parse(await readFile(join(config.DATA_DIR, "sources", "manual-places.json"), "utf8")),
  );

const entries = buildGazetteer(
  {
    geocodedLocales: Nkby2018.geocodedLocales.parse(await read("geocoded-locales.json")),
    locales: Nkby2018.locales.parse(await read("locales.json")),
    areas: Nkby2018.areas.parse(await read("areas.json")),
    postalAreas: Nkby2018.postalAreas.parse(await read("postal-areas.json")),
  },
  manual,
);
// One entry per line: readable and gives small git diffs.
await writeFile(
  gazetteerPath(config.DATA_DIR),
  `[\n${entries.map((e) => `  ${JSON.stringify(e)}`).join(",\n")}\n]\n`,
);
const located = entries.filter((e) => e.location).length;
const todo = entries.filter((e) => e.missingLocation);
console.log(`Wrote ${entries.length} names (${located} with coordinates).`);
console.log(`${todo.length} need coordinates added by hand: ${todo.map((e) => e.name).join(", ")}`);
