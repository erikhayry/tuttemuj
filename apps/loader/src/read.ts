import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { PageExtraction, PageGroup, PlaceEntity } from "@tuttemuj/schema";
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
  return {
    pages,
    places: await json("places.json", Schema.Array(PlaceEntity)),
    groups: await json("page-groups.json", Schema.Array(PageGroup)),
  };
}
