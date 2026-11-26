// Everything the tool reads from data/ once, at start-up. Only manual-places.json changes while it
// runs, and that is read again on every request.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { readGazetteerEntries } from "@tuttemuj/crawler/gazetteer/load";
import { rankUnlocated } from "@tuttemuj/crawler/gazetteer/unlocated";
import { readJsonl } from "@tuttemuj/crawler/jsonl";
import { FrontierEntry, ImageClassification, PageExtraction } from "@tuttemuj/schema";
import { Context, Effect, Layer, Schema } from "effect";

const readPages = async (dataDir: string) => {
  const dir = join(dataDir, "pages");
  const files = (await readdir(dir, { recursive: true })).filter((f) => f.endsWith(".json"));
  return Promise.all(
    files.map(async (file) =>
      Schema.decodeUnknownSync(PageExtraction)(JSON.parse(await readFile(join(dir, file), "utf8"))),
    ),
  );
};

const load = async (dataDir: string) => {
  const [entries, pages, frontier, classified] = await Promise.all([
    readGazetteerEntries(dataDir),
    readPages(dataDir),
    readJsonl(join(dataDir, "frontier.jsonl"), FrontierEntry),
    readJsonl(join(dataDir, "images.jsonl"), ImageClassification),
  ]);
  return {
    entries: new Map(entries.map((e) => [e.name, e])),
    /** Most mentioned first. */
    ranked: rankUnlocated(entries, pages),
    pages: new Map(pages.map((p) => [p.sourceUrl, p])),
    images: new Map(frontier.map((f) => [f.url, f.images ?? []])),
    /** Images the nightly classification could not use (logos, broken files). */
    unusable: new Set(classified.flatMap((c) => ("skipped" in c ? [c.url] : []))),
  };
};

export type Data = Awaited<ReturnType<typeof load>>;

// A `Context.Service` names a dependency; a Layer says how to build it. Handlers ask for
// `CoordsData` and get the loaded files, a bit like React context but checked by the compiler.
export class CoordsData extends Context.Service<CoordsData, Data & { dataDir: string }>()(
  "coords/CoordsData",
) {
  static layer = (dataDir: string) =>
    Layer.effect(
      CoordsData,
      Effect.promise(async () => ({ ...(await load(dataDir)), dataDir })),
    );
}
