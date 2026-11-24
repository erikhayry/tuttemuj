import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { GazetteerEntry } from "@tuttemuj/schema";
import { Schema } from "effect";
import { Gazetteer } from "./geocode.ts";

export const gazetteerPath = (dataDir: string): string => join(dataDir, "gazetteer.json");

export async function readGazetteerEntries(dataDir: string): Promise<GazetteerEntry[]> {
  return [
    ...Schema.decodeUnknownSync(Schema.Array(GazetteerEntry))(
      JSON.parse(await readFile(gazetteerPath(dataDir), "utf8")),
    ),
  ];
}

/** The gazetteer, or undefined if data/gazetteer.json has not been built yet. */
export async function loadGazetteer(dataDir: string): Promise<Gazetteer | undefined> {
  try {
    return new Gazetteer(await readGazetteerEntries(dataDir));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw err;
  }
}
