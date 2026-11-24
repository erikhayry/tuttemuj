import { createHash } from "node:crypto";
import type { ImageRef, SourceUrl } from "@tuttemuj/schema";
import * as cheerio from "cheerio";
import { findImages, markImages } from "./images/find.ts";
import { normalizeUrl } from "./url.ts";

export type ParsedPage = {
  title: string;
  /** Visible text, whitespace-collapsed. Used for hashing; never committed. Must not change. */
  text: string;
  /**
   * The same text with `[bild n: alt]` markers where the large images are, for the extractor. Kept
   * apart from `text` so adding markers does not change any page's `contentHash`.
   */
  markedText: string;
  links: SourceUrl[];
  /** Large images on the page (references only). */
  images: ImageRef[];
};

export function parsePage(html: string, pageUrl: SourceUrl): ParsedPage {
  const $ = cheerio.load(html);
  const links = new Set<SourceUrl>();
  $("a[href], area[href], frame[src], iframe[src]").each((_, el) => {
    const raw = $(el).attr("href") ?? $(el).attr("src");
    const url = raw ? normalizeUrl(raw, pageUrl) : undefined;
    if (url && url !== pageUrl) links.add(url);
  });

  const images = findImages($, pageUrl);

  $("script, style, noscript").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  const title = $("title").first().text().replace(/\s+/g, " ").trim();

  // Markers go in last: `text` above is taken before the DOM is changed.
  markImages($, pageUrl, images);
  const markedText = $("body").text().replace(/\s+/g, " ").trim();

  return { title, text, markedText, links: [...links].sort(), images };
}

export const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");
