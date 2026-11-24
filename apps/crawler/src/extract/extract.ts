import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  EXTRACTION_VERSION,
  ExtractionTask,
  type FrontierEntry,
  isEnriched,
  NO_CONTENT_PAGE_TYPES,
  noContentPageType,
  PageExtraction,
  PageExtractionDraft,
  safeDecode,
} from "@tuttemuj/schema";
import { Schema } from "effect";
import type { PageCache } from "../cache.ts";
import type { Frontier } from "../frontier.ts";
import type { Gazetteer } from "../gazetteer/geocode.ts";
import { parsePage } from "../parse.ts";
import { readJson, writeJson } from "./json.ts";
import type { extractionPaths } from "./paths.ts";

type Paths = ReturnType<typeof extractionPaths>;

/** A fetched page needs analysis if it has none, its content changed, or the extraction version is old. */
async function needsExtraction(entry: FrontierEntry, paths: Paths): Promise<boolean> {
  if (entry.status !== "fetched" || !entry.contentHash) return false;
  const existing = safeDecode(PageExtraction)(await readJson(paths.page(entry.url)));
  if (!existing.success || existing.data.contentHash !== entry.contentHash) return true;
  // An empty page or a menu is not worth redoing for a new version; only if its content changes.
  const { pageType } = existing.data;
  if (pageType !== undefined && NO_CONTENT_PAGE_TYPES.has(pageType)) return false;
  // An enriched page (`/enrich-pages`) already has the fields the newer version added, so a version
  // bump does not queue it again. New pages get the full extraction instead.
  if (isEnriched(existing.data)) return false;
  return existing.data.extractionVersion < EXTRACTION_VERSION;
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
    await writeFile(textPath, `${page.title}\n\n${page.markedText}\n`);
    tasks.push(
      Schema.decodeUnknownSync(ExtractionTask)({
        sourceUrl: entry.url,
        title: page.title,
        contentHash: entry.contentHash,
        textPath,
        draftPath: paths.draft(entry.url),
      }),
    );
  }
  await writeJson(paths.batch, tasks);
  const { schema, definitions } = Schema.toJsonSchemaDocument(PageExtractionDraft);
  await writeJson(paths.schema, { ...schema, $defs: definitions });
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
  const tasks = Schema.decodeUnknownSync(Schema.Array(ExtractionTask))(
    (await readJson(paths.batch)) ?? [],
  );
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
    const draft = safeDecode(PageExtractionDraft)(raw);
    if (!draft.success) {
      result.invalid.push({ url: task.sourceUrl, error: draft.message });
      continue;
    }
    if (draft.data.sourceUrl !== task.sourceUrl) {
      result.invalid.push({ url: task.sourceUrl, error: `sourceUrl is ${draft.data.sourceUrl}` });
      continue;
    }
    // Mark pages without content of their own, unless the analyst already set a page type.
    const pageType = draft.data.pageType ?? noContentPageType(draft.data);
    const page = Schema.decodeUnknownSync(PageExtraction)({
      ...draft.data,
      ...(pageType ? { pageType } : {}),
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
