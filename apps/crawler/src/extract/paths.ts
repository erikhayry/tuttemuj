import { join } from "node:path";
import type { SourceUrl } from "@tuttemuj/schema";

/** Stable id from the URL path, e.g. "sidor/texter/hus/a" (case preserved). */
export const pageId = (url: SourceUrl): string =>
  decodeURIComponent(new URL(url).pathname)
    .replace(/^\//, "")
    .replace(/\.html?$/i, "");

export const extractionPaths = (dataDir: string, cacheDir: string) => ({
  batch: join(cacheDir, "extract", "batch.json"),
  schema: join(cacheDir, "extract", "draft.schema.json"),
  text: (url: SourceUrl) => join(cacheDir, "extract", "text", `${pageId(url)}.txt`),
  draft: (url: SourceUrl) => join(cacheDir, "extract", "drafts", `${pageId(url)}.json`),
  page: (url: SourceUrl) => join(dataDir, "pages", `${pageId(url)}.json`),
});
