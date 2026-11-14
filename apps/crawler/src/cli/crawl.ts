import { join } from "node:path";
import { PageCache } from "../cache.ts";
import { loadConfig } from "../config.ts";
import { runCrawl } from "../crawl.ts";
import { Frontier } from "../frontier.ts";
import { appendJsonl } from "../jsonl.ts";

const config = loadConfig();
const frontier = await Frontier.load(join(config.DATA_DIR, "frontier.jsonl"));
if (frontier.count() === 0) {
  console.error("Frontier is empty. Run `pnpm --filter @tuttemuj/crawler seed` first.");
  process.exit(1);
}

const run = await runCrawl({ config, frontier, cache: new PageCache(config.CACHE_DIR) });
await appendJsonl(join(config.DATA_DIR, "runs.jsonl"), run);
console.log(
  `Done: ${run.fetched} fetched, ${run.gone} gone, ${run.failed} failed, ` +
    `${run.discovered} new URLs, ${run.pendingAfter} pending.`,
);
