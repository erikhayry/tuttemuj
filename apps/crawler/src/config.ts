import { fileURLToPath } from "node:url";
import { SOURCE_ORIGIN } from "@tuttemuj/schema";
import { z } from "zod";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

const Config = z.object({
  /** Max URLs fetched per run (one run per night). */
  CRAWL_LIMIT: z.coerce.number().int().positive().default(1000),
  /** Pause between requests, to keep load on the source site low. */
  CRAWL_DELAY_MS: z.coerce.number().int().min(1000).default(5000),
  CRAWL_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  /** Page with newly posted content. Re-fetched every run; links not yet known are crawled. */
  ENTRY_URL: z.string().url().default(`${SOURCE_ORIGIN}/sidor/nyheter/nyinfort.htm`),
  CRAWL_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
  USER_AGENT: z
    .string()
    .default("TuttemujBot/0.1 (+https://github.com/erikhayry/tuttemuj; polite nightly crawl)"),
  DATA_DIR: z.string().default(`${REPO_ROOT}data`),
  CACHE_DIR: z.string().default(`${REPO_ROOT}.cache`),
});
export type Config = z.infer<typeof Config>;

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config => Config.parse(env);
