import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  ENRICH_VERSION,
  EnrichmentTask,
  needsEnrichment,
  PageEnrichmentDraft,
  PageExtraction,
  safeDecode,
} from "@tuttemuj/schema";
import { Schema } from "effect";
import type { PageCache } from "../cache.ts";
import type { Frontier } from "../frontier.ts";
import { parsePage } from "../parse.ts";
import type { SaveResult } from "./extract.ts";
import { readJson, writeJson } from "./json.ts";
import type { enrichmentPaths } from "./paths.ts";

type Paths = ReturnType<typeof enrichmentPaths>;

/** The text the analyst reads: the names already on the page, then the page with `[bild n]` markers. */
function enrichmentText(page: PageExtraction, title: string, markedText: string, images: number) {
  const people = page.people.map(
    (p) => `- ${p.name}${p.alternateNames.length ? ` (also: ${p.alternateNames.join(", ")})` : ""}`,
  );
  const places = page.places.map(
    (p) =>
      `- ${p.name} [${p.kind}]${p.alternateNames.length ? ` (also: ${p.alternateNames.join(", ")})` : ""}`,
  );
  return [
    title,
    "",
    "People on this page (use exactly these names):",
    ...(people.length ? people : ["- (none)"]),
    "",
    "Places on this page (use exactly these names):",
    ...(places.length ? places : ["- (none)"]),
    "",
    `Images: ${images}${images ? " (marked [bild n] in the text)" : ""}`,
    "",
    "---",
    "",
    markedText,
    "",
  ].join("\n");
}

/**
 * Write the next batch of already extracted pages that need the v1 fields. A page whose content has
 * changed since it was extracted is skipped: `/extract-pages` redoes it in full first.
 */
export async function prepareEnrichBatch(opts: {
  frontier: Frontier;
  cache: PageCache;
  paths: Paths;
  limit: number;
}): Promise<EnrichmentTask[]> {
  const { frontier, cache, paths, limit } = opts;
  const tasks: EnrichmentTask[] = [];
  for (const entry of frontier.byPriority("fetched")) {
    if (tasks.length >= limit) break;
    if (!entry.contentHash) continue;
    const existing = safeDecode(PageExtraction)(await readJson(paths.page(entry.url)));
    if (!existing.success || existing.data.contentHash !== entry.contentHash) continue;
    if (!needsEnrichment(existing.data)) continue;
    const html = await cache.read(entry.url);
    if (!html) continue; // Cache missing (e.g. other machine); skip.
    const page = parsePage(html, entry.url);
    const textPath = paths.text(entry.url);
    await mkdir(dirname(textPath), { recursive: true });
    await writeFile(
      textPath,
      enrichmentText(existing.data, page.title, page.markedText, page.images.length),
    );
    tasks.push(
      Schema.decodeUnknownSync(EnrichmentTask)({
        sourceUrl: entry.url,
        title: page.title,
        contentHash: entry.contentHash,
        textPath,
        draftPath: paths.draft(entry.url),
        imageCount: page.images.length,
      }),
    );
  }
  await writeJson(paths.batch, tasks);
  const { schema, definitions } = Schema.toJsonSchemaDocument(PageEnrichmentDraft);
  await writeJson(paths.schema, { ...schema, $defs: definitions });
  return tasks;
}

/**
 * Add a draft's fields to a page file and stamp it. Works on the raw JSON, so the old fields keep
 * exactly the shape they have on disk. Returns the errors instead of a page when the draft refers to
 * a person, place or image the page does not have.
 */
export function mergeEnrichment(
  raw: Record<string, unknown>,
  draft: PageEnrichmentDraft,
  imageCount: number,
  now: string,
): { page: Record<string, unknown> } | { errors: string[] } {
  const page = Schema.decodeUnknownSync(PageExtraction)(raw);
  const people = new Set(page.people.map((p) => p.name));
  const places = new Set(page.places.map((p) => p.name));
  const errors: string[] = [];

  for (const [i, r] of draft.relations.entries()) {
    if (!people.has(r.person))
      errors.push(`relations[${i}]: "${r.person}" is not in the page's people`);
    if (!places.has(r.place))
      errors.push(`relations[${i}]: "${r.place}" is not in the page's places`);
  }
  const seenImages = new Set<number>();
  for (const [i, im] of draft.images.entries()) {
    if (im.image > imageCount)
      errors.push(`images[${i}]: [bild ${im.image}] does not exist (${imageCount} images)`);
    if (seenImages.has(im.image)) errors.push(`images[${i}]: [bild ${im.image}] is listed twice`);
    seenImages.add(im.image);
    for (const name of im.places)
      if (!places.has(name)) errors.push(`images[${i}]: "${name}" is not in the page's places`);
  }
  const seenPlaces = new Set<string>();
  for (const [i, p] of draft.places.entries()) {
    if (!places.has(p.name)) errors.push(`places[${i}]: "${p.name}" is not in the page's places`);
    if (seenPlaces.has(p.name)) errors.push(`places[${i}]: "${p.name}" is listed twice`);
    seenPlaces.add(p.name);
  }
  if (errors.length) return { errors };

  const additions = new Map(draft.places.map((p) => [p.name, p]));
  const rawPlaces = (raw.places as Record<string, unknown>[] | undefined) ?? [];
  const merged: Record<string, unknown> = {
    ...raw,
    places: rawPlaces.map((p) => {
      const add = additions.get(p.name as string);
      if (!add) return p;
      return {
        ...p,
        ...(add.uses ? { uses: add.uses } : {}),
        ...(add.nameOrigin ? { nameOrigin: add.nameOrigin } : {}),
      };
    }),
    pageType: draft.pageType,
    relations: draft.relations,
    images: draft.images,
    // Keep stamps from other add-on skills; replace our own older one.
    enrichments: [
      ...(page.enrichments ?? []).filter((e) => e.skill !== "enrich-pages"),
      { skill: "enrich-pages", version: ENRICH_VERSION, model: draft.model, enrichedAt: now },
    ],
  };
  try {
    Schema.decodeUnknownSync(PageExtraction)(merged); // the result must still be a valid page
  } catch (err) {
    return { errors: [String(err)] };
  }
  return { page: merged };
}

/** Validate the drafts of the current batch and merge each into its page file in data/pages. */
export async function saveEnrichments(opts: { paths: Paths; now?: Date }): Promise<SaveResult> {
  const { paths } = opts;
  const now = (opts.now ?? new Date()).toISOString();
  const tasks = Schema.decodeUnknownSync(Schema.Array(EnrichmentTask))(
    (await readJson(paths.batch)) ?? [],
  );
  const result: SaveResult = { saved: [], missing: [], invalid: [] };

  for (const task of tasks) {
    let rawDraft: unknown;
    try {
      rawDraft = await readJson(task.draftPath);
    } catch (err) {
      result.invalid.push({ url: task.sourceUrl, error: `Invalid JSON: ${String(err)}` });
      continue;
    }
    if (rawDraft === undefined) {
      result.missing.push(task.sourceUrl);
      continue;
    }
    const draft = safeDecode(PageEnrichmentDraft)(rawDraft);
    if (!draft.success) {
      result.invalid.push({ url: task.sourceUrl, error: draft.message });
      continue;
    }
    if (draft.data.sourceUrl !== task.sourceUrl) {
      result.invalid.push({ url: task.sourceUrl, error: `sourceUrl is ${draft.data.sourceUrl}` });
      continue;
    }
    const raw = (await readJson(paths.page(task.sourceUrl))) as Record<string, unknown> | undefined;
    if (!raw || raw.contentHash !== task.contentHash) {
      result.invalid.push({
        url: task.sourceUrl,
        error: "The page file changed since the batch was made.",
      });
      continue;
    }
    const merged = mergeEnrichment(raw, draft.data, task.imageCount, now);
    if ("errors" in merged) {
      result.invalid.push({ url: task.sourceUrl, error: merged.errors.join("\n") });
      continue;
    }
    await writeJson(paths.page(task.sourceUrl), merged.page);
    await rm(task.draftPath);
    result.saved.push(task.sourceUrl);
  }
  return result;
}
