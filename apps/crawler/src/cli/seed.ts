import { join } from "node:path";
import { SOURCE_ORIGIN } from "@tuttemuj/schema";
import { loadConfig } from "../config.ts";
import { fetchPage } from "../fetcher.ts";
import { Frontier } from "../frontier.ts";
import { parsePage } from "../parse.ts";
import { normalizeUrl } from "../url.ts";

/** Seed the frontier from the (outdated) sitemap plus the site's entry page. */
const SITEMAP = `${SOURCE_ORIGIN}/sitemap/sitemap.htm`;

const config = loadConfig();
const ENTRY = config.ENTRY_URL;
const frontier = await Frontier.load(join(config.DATA_DIR, "frontier.jsonl"));

const result = await fetchPage(SITEMAP, {
  userAgent: config.USER_AGENT,
  // The sitemap is ~6 MB.
  timeoutMs: 120_000,
});
if (result.kind !== "ok") {
  console.error(`Could not fetch sitemap: ${JSON.stringify(result)}`);
  process.exit(1);
}

let added = frontier.add(ENTRY) ? 1 : 0;
// Sitemap links are discovery hints only; the sitemap itself is not a content page.
for (const link of parsePage(result.html, SITEMAP).links) {
  const url = normalizeUrl(link);
  if (url && frontier.add(url)) added++;
}
await frontier.save();
console.log(`Seeded ${added} new URLs (${frontier.count()} total).`);
