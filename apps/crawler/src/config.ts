import { fileURLToPath } from "node:url";
import { EnvUrl, envInt, envString, readEnv, SOURCE_ORIGIN } from "@tuttemuj/schema";
import { Effect, Schema } from "effect";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

const Config = Schema.Struct({
  /** Max URLs fetched per run (one run per night). */
  CRAWL_LIMIT: envInt(1000, Schema.isGreaterThan(0)),
  /** Pause between requests, to keep load on the source site low. */
  CRAWL_DELAY_MS: envInt(5000, Schema.isGreaterThanOrEqualTo(1000)),
  CRAWL_TIMEOUT_MS: envInt(30_000, Schema.isGreaterThan(0)),
  /** Page with newly posted content. Re-fetched every run; links not yet known are crawled. */
  ENTRY_URL: EnvUrl.pipe(
    Schema.withDecodingDefaultTypeKey(
      Effect.succeed(`${SOURCE_ORIGIN}/sidor/nyheter/nyinfort.htm`),
    ),
  ),
  CRAWL_MAX_ATTEMPTS: envInt(3, Schema.isGreaterThan(0)),
  USER_AGENT: envString(
    "TuttemujBot/0.1 (+https://github.com/erikhayry/tuttemuj; polite nightly crawl)",
  ),
  DATA_DIR: envString(`${REPO_ROOT}data`),
  CACHE_DIR: envString(`${REPO_ROOT}.cache`),
});
export type Config = typeof Config.Type;

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config => readEnv(Config, env);
