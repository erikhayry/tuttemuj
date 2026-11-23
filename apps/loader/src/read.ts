import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { PageExtraction, PageGroup, PlaceEntity } from "@tuttemuj/schema";
import { z } from "zod";

/** Read and validate the files the database is built from. */
export async function readData(dataDir: string) {
  const pagesDir = join(dataDir, "pages");
  const files = (await readdir(pagesDir, { recursive: true })).filter((f) => f.endsWith(".json"));
  const pages = await Promise.all(
    files.map(async (f) =>
      PageExtraction.parse(JSON.parse(await readFile(join(pagesDir, f), "utf8"))),
    ),
  );
  const json = async <T extends z.ZodType>(file: string, schema: T): Promise<z.infer<T>> =>
    schema.parse(JSON.parse(await readFile(join(dataDir, "entities", file), "utf8")));
  return {
    pages,
    places: await json("places.json", z.array(PlaceEntity)),
    groups: await json("page-groups.json", z.array(PageGroup)),
  };
}
