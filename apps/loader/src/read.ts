import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  FrontierEntry,
  ImageClassification,
  PageExtraction,
  PageGroup,
  PlaceEntity,
} from "@tuttemuj/schema";
import { Schema } from "effect";

/** Read and validate the files the database is built from. */
export async function readData(dataDir: string) {
  const pagesDir = join(dataDir, "pages");
  const files = (await readdir(pagesDir, { recursive: true })).filter((f) => f.endsWith(".json"));
  const pages = await Promise.all(
    files.map(async (f) =>
      Schema.decodeUnknownSync(PageExtraction)(
        JSON.parse(await readFile(join(pagesDir, f), "utf8")),
      ),
    ),
  );
  const json = async <S extends Schema.ConstraintDecoder<unknown>>(
    file: string,
    schema: S,
  ): Promise<S["Type"]> =>
    Schema.decodeUnknownSync(schema)(
      JSON.parse(await readFile(join(dataDir, "entities", file), "utf8")),
    );
  // One JSON value per line; a missing file is an empty list (images.jsonl exists after the first
  // `images:classify` run).
  const jsonl = async <S extends Schema.ConstraintDecoder<unknown>>(
    file: string,
    schema: S,
  ): Promise<S["Type"][]> => {
    let text: string;
    try {
      text = await readFile(join(dataDir, file), "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
    return text
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => Schema.decodeUnknownSync(schema)(JSON.parse(l)));
  };
  return {
    // Where each page's large images are, and what Jev said about them.
    frontier: await jsonl("frontier.jsonl", FrontierEntry),
    imageClasses: await jsonl("images.jsonl", ImageClassification),
    pages,
    places: await json("places.json", Schema.Array(PlaceEntity)),
    groups: await json("page-groups.json", Schema.Array(PageGroup)),
  };
}
