/** Fill in `images` for already-fetched pages from the local HTML cache. No requests to the site. */
import { join } from "node:path";
import { PageCache } from "../cache.ts";
import { loadConfig } from "../config.ts";
import { Frontier } from "../frontier.ts";
import { parsePage } from "../parse.ts";

const config = loadConfig();
const frontier = await Frontier.load(join(config.DATA_DIR, "frontier.jsonl"));
const cache = new PageCache(config.CACHE_DIR);

let pages = 0;
let images = 0;
let missing = 0;
for (const entry of frontier.byPriority("fetched")) {
  const html = await cache.read(entry.url);
  if (html === undefined) {
    missing++;
    continue;
  }
  const page = parsePage(html, entry.url);
  frontier.update({ ...entry, images: page.images });
  pages++;
  images += page.images.length;
}
await frontier.save();
console.log(`Backfilled ${pages} pages, ${images} images (${missing} not in cache).`);
