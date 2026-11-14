import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  EXTRACTION_VERSION,
  ExtractionTask,
  type FrontierEntry,
  PageExtraction,
  PageExtractionDraft,
} from "@tuttemuj/schema";
import { z } from "zod";
import type { PageCache } from "../cache.ts";
import type { Frontier } from "../frontier.ts";
import type { Gazetteer } from "../gazetteer/geocode.ts";
import { parsePage } from "../parse.ts";
import type { extractionPaths } from "./paths.ts";

type Paths = ReturnType<typeof extractionPaths>;

async function readJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw err;
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

/** A fetched page needs analysis if it has none, its content changed, or the extraction version is old. */
async function needsExtraction(entry: FrontierEntry, paths: Paths): Promise<boolean> {
  if (entry.status !== "fetched" || !entry.contentHash) return false;
  const existing = PageExtraction.safeParse(await readJson(paths.page(entry.url)));
  return (
    !existing.success ||
    existing.data.contentHash !== entry.contentHash ||
    existing.data.extractionVersion < EXTRACTION_VERSION
  );
}

/** Write the next batch of pages to analyse: plain-text files, batch.json and the draft JSON Schema. */
export async function prepareBatch(opts: {
  frontier: Frontier;
  cache: PageCache;
  paths: Paths;
  limit: number;
}): Promise<ExtractionTask[]> {
  const { frontier, cache, paths, limit } = opts;
  const tasks: ExtractionTask[] = [];
  for (const entry of frontier.byPriority("fetched")) {
    if (tasks.length >= limit) break;
    if (!(await needsExtraction(entry, paths))) continue;
    const html = await cache.read(entry.url);
    if (!html || !entry.contentHash) continue; // Cache missing (e.g. other machine); skip.
    const page = parsePage(html, entry.url);
    const textPath = paths.text(entry.url);
    await mkdir(dirname(textPath), { recursive: true });
    await writeFile(textPath, `${page.title}\n\n${page.text}\n`);
    tasks.push(
      ExtractionTask.parse({
        sourceUrl: entry.url,
        title: page.title,
        contentHash: entry.contentHash,
        textPath,
        draftPath: paths.draft(entry.url),
      }),
    );
  }
  await writeJson(paths.batch, tasks);
  await writeJson(paths.schema, z.toJSONSchema(PageExtractionDraft, { io: "input" }));
  return tasks;
}

export type SaveResult = {
  saved: string[];
  missing: string[];
  invalid: Array<{ url: string; error: string }>;
};

/** Validate drafts for the current batch, stamp bookkeeping fields, geocode and write them to data/pages. */
export async function saveDrafts(opts: {
  paths: Paths;
  now?: Date;
  /** When given, places get coordinates from the gazetteer. */
  gazetteer?: Gazetteer;
}): Promise<SaveResult> {
  const { paths } = opts;
  const now = (opts.now ?? new Date()).toISOString();
  const tasks = z.array(ExtractionTask).parse((await readJson(paths.batch)) ?? []);
  const result: SaveResult = { saved: [], missing: [], invalid: [] };

  for (const task of tasks) {
    let raw: unknown;
    try {
      raw = await readJson(task.draftPath);
    } catch (err) {
      result.invalid.push({ url: task.sourceUrl, error: `Invalid JSON: ${String(err)}` });
      continue;
    }
    if (raw === undefined) {
      result.missing.push(task.sourceUrl);
      continue;
    }
    const draft = PageExtractionDraft.safeParse(raw);
    if (!draft.success) {
      result.invalid.push({ url: task.sourceUrl, error: z.prettifyError(draft.error) });
      continue;
    }
    if (draft.data.sourceUrl !== task.sourceUrl) {
      result.invalid.push({ url: task.sourceUrl, error: `sourceUrl is ${draft.data.sourceUrl}` });
      continue;
    }
    const page = PageExtraction.parse({
      ...draft.data,
      contentHash: task.contentHash,
      extractionVersion: EXTRACTION_VERSION,
      extractedAt: now,
    });
    await writeJson(paths.page(task.sourceUrl), opts.gazetteer?.geocodePage(page) ?? page);
    await rm(task.draftPath);
    result.saved.push(task.sourceUrl);
  }
  return result;
}
