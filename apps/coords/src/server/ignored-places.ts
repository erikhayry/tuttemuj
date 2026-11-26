// Read data/sources/ignored-places.json and add places that are outside Nykarleby to its end.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { IgnoredPlace, normalizeName } from "@tuttemuj/schema";
import { Schema } from "effect";
import { writeAtomically } from "./write-file.ts";

const decodePlaces = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Array(IgnoredPlace)));

const path = (dataDir: string) => join(dataDir, "sources", "ignored-places.json");

export const readIgnoredNames = async (dataDir: string) =>
  new Set(decodePlaces(await readFile(path(dataDir), "utf8")).map((p) => normalizeName(p.name)));

/** Names already in the file are left as they are. */
export const ignoreOutside = async (dataDir: string, names: readonly string[]) => {
  const known = await readIgnoredNames(dataDir);
  const added = [...new Set(names.map(normalizeName))].filter((n) => !known.has(n));
  if (added.length === 0) return;
  const text = await readFile(path(dataDir), "utf8");
  const entries = added.map(
    (name) => `  {\n    "name": ${JSON.stringify(name)},\n    "reason": "outside-nykarleby"\n  }`,
  );
  // Insert before the closing bracket, so the existing lines stay untouched.
  const head = text.replace(/\s*\]\s*$/, "");
  const next = `${head}${known.size > 0 ? "," : ""}\n${entries.join(",\n")}\n]\n`;
  decodePlaces(next); // Never write a file the gazetteer build cannot read.
  await writeAtomically(path(dataDir), next);
};
