/** Build data/gazetteer.json from nkby-2018, manual-places.json and ignored-places.json. */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { IgnoredPlace, ManualPlace, Nkby2018 } from "@tuttemuj/schema";
import { Schema } from "effect";
import { loadConfig } from "../config.ts";
import { buildGazetteer } from "../gazetteer/build.ts";
import { gazetteerPath } from "../gazetteer/load.ts";

const config = loadConfig();
const dir = join(config.DATA_DIR, "sources", "nkby-2018");
const read = async (file: string) => JSON.parse(await readFile(join(dir, file), "utf8"));

const manual = Schema.decodeUnknownSync(Schema.Array(ManualPlace))(
  JSON.parse(await readFile(join(config.DATA_DIR, "sources", "manual-places.json"), "utf8")),
);

const ignored = Schema.decodeUnknownSync(Schema.Array(IgnoredPlace))(
  JSON.parse(await readFile(join(config.DATA_DIR, "sources", "ignored-places.json"), "utf8")),
);

const entries = buildGazetteer(
  {
    geocodedLocales: Schema.decodeUnknownSync(Nkby2018.geocodedLocales)(
      await read("geocoded-locales.json"),
    ),
    locales: Schema.decodeUnknownSync(Nkby2018.locales)(await read("locales.json")),
    areas: Schema.decodeUnknownSync(Nkby2018.areas)(await read("areas.json")),
    postalAreas: Schema.decodeUnknownSync(Nkby2018.postalAreas)(await read("postal-areas.json")),
  },
  manual,
  ignored,
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
