import { loadConfig } from "../config.ts";
import { saveEnrichments } from "../extract/enrich.ts";
import { enrichmentPaths } from "../extract/paths.ts";

const config = loadConfig();
const result = await saveEnrichments({ paths: enrichmentPaths(config.DATA_DIR, config.CACHE_DIR) });

for (const url of result.saved) console.log(`✓ ${url}`);
for (const url of result.missing) console.log(`… ${url} (no draft yet)`);
for (const { url, error } of result.invalid) console.log(`✗ ${url}\n${error}\n`);
console.log(
  `Saved ${result.saved.length}, missing ${result.missing.length}, invalid ${result.invalid.length}.`,
);
if (result.invalid.length) process.exit(1);
