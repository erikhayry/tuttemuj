import { join } from "node:path";
import { PageCache } from "../cache.ts";
import { loadConfig } from "../config.ts";
import { prepareEnrichBatch } from "../extract/enrich.ts";
import { enrichmentPaths } from "../extract/paths.ts";
import { Frontier } from "../frontier.ts";

const limit = Number(process.argv[2] ?? 10);
if (!Number.isInteger(limit) || limit <= 0) {
  console.error("Usage: enrich:next [count]");
  process.exit(1);
}

const config = loadConfig();
const paths = enrichmentPaths(config.DATA_DIR, config.CACHE_DIR);
const tasks = await prepareEnrichBatch({
  frontier: await Frontier.load(join(config.DATA_DIR, "frontier.jsonl")),
  cache: new PageCache(config.CACHE_DIR),
  paths,
  limit,
});

console.log(`Batch: ${tasks.length} page(s) -> ${paths.batch}`);
console.log(`Draft schema: ${paths.schema}`);
for (const t of tasks)
  console.log(`- ${t.sourceUrl}\n  text:  ${t.textPath}\n  draft: ${t.draftPath}`);
