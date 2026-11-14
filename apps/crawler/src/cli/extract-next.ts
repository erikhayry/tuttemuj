import { join } from "node:path";
import { PageCache } from "../cache.ts";
import { loadConfig } from "../config.ts";
import { prepareBatch } from "../extract/extract.ts";
import { extractionPaths } from "../extract/paths.ts";
import { Frontier } from "../frontier.ts";

const limit = Number(process.argv[2] ?? 10);
if (!Number.isInteger(limit) || limit <= 0) {
  console.error("Usage: extract:next [count]");
  process.exit(1);
}

const config = loadConfig();
const paths = extractionPaths(config.DATA_DIR, config.CACHE_DIR);
const tasks = await prepareBatch({
  frontier: await Frontier.load(join(config.DATA_DIR, "frontier.jsonl")),
  cache: new PageCache(config.CACHE_DIR),
  paths,
  limit,
});

console.log(`Batch: ${tasks.length} page(s) -> ${paths.batch}`);
console.log(`Draft schema: ${paths.schema}`);
for (const t of tasks)
  console.log(`- ${t.sourceUrl}\n  text:  ${t.textPath}\n  draft: ${t.draftPath}`);
