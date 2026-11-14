import { loadConfig } from "../config.ts";
import { saveDrafts } from "../extract/extract.ts";
import { extractionPaths } from "../extract/paths.ts";
import { loadGazetteer } from "../gazetteer/load.ts";

const config = loadConfig();
const gazetteer = await loadGazetteer(config.DATA_DIR);
if (!gazetteer) console.warn("No data/gazetteer.json; places are saved without coordinates.");
const result = await saveDrafts({
  paths: extractionPaths(config.DATA_DIR, config.CACHE_DIR),
  ...(gazetteer ? { gazetteer } : {}),
});

for (const url of result.saved) console.log(`✓ ${url}`);
for (const url of result.missing) console.log(`… ${url} (no draft yet)`);
for (const { url, error } of result.invalid) console.log(`✗ ${url}\n${error}\n`);
console.log(
  `Saved ${result.saved.length}, missing ${result.missing.length}, invalid ${result.invalid.length}.`,
);
if (result.invalid.length) process.exit(1);
