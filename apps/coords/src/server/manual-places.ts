// Read data/sources/manual-places.json and add a location to it, changing nothing else in the file.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { type GazetteerKind, type GeoPoint, ManualPlace, normalizeName } from "@tuttemuj/schema";
import { Schema } from "effect";
import { writeAtomically } from "./write-file.ts";

const decodePlaces = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Array(ManualPlace)));

const path = (dataDir: string) => join(dataDir, "sources", "manual-places.json");

export const readManualPlaces = async (dataDir: string) =>
  decodePlaces(await readFile(path(dataDir), "utf8"));

/** Where each top-level `{…}` of a JSON array starts and ends in the text. */
const objectSpans = (text: string): Array<[start: number, end: number]> => {
  const spans: Array<[number, number]> = [];
  let depth = 0;
  let start = 0;
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (char === "\\") i++;
      else if (char === '"') inString = false;
    } else if (char === '"') inString = true;
    else if (char === "{") {
      if (depth++ === 0) start = i;
    } else if (char === "}") {
      if (--depth === 0) spans.push([start, i + 1]);
    }
  }
  return spans;
};

type NewLocation = { name: string; kind: GazetteerKind; location: GeoPoint };

/**
 * The file's text with the location added to the place's entry, or to a new entry placed by name.
 * Undefined when the entry already has a location.
 */
const withLocation = (text: string, { name, kind, location }: NewLocation): string | undefined => {
  const places = decodePlaces(text);
  const spans = objectSpans(text);
  const line = `"location": { "lat": ${location.lat}, "lng": ${location.lng} }`;
  const index = places.findIndex((p) => normalizeName(p.name) === name);
  const span = spans[index];

  if (span) {
    if (places[index]?.location) return undefined;
    const [start, end] = span;
    const entry = text.slice(start, end).replace(/\s*\}$/, `,\n    ${line}\n  }`);
    return text.slice(0, start) + entry + text.slice(end);
  }

  const entry = `{\n    "name": ${JSON.stringify(name)},\n    "kind": "${kind}",\n    ${line}\n  }`;
  const after = spans[places.findIndex((p) => p.name.localeCompare(name, "sv") > 0)];
  if (after) return `${text.slice(0, after[0])}${entry},\n  ${text.slice(after[0])}`;
  const last = spans.at(-1);
  if (!last) return `[\n  ${entry}\n]\n`;
  return `${text.slice(0, last[1])},\n  ${entry}${text.slice(last[1])}`;
};

/** Returns false when the place already had a location. */
export const saveLocation = async (dataDir: string, place: NewLocation): Promise<boolean> => {
  const next = withLocation(await readFile(path(dataDir), "utf8"), place);
  if (next === undefined) return false;
  decodePlaces(next); // Never write a file the gazetteer build cannot read.
  await writeAtomically(path(dataDir), next);
  return true;
};
