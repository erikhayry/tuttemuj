import { createHash } from "node:crypto";
import type { SourceUrl } from "@tuttemuj/schema";
import * as cheerio from "cheerio";
import { normalizeUrl } from "./url.ts";

export type ParsedPage = {
  title: string;
  /** Visible text, whitespace-collapsed. Used for hashing and extraction; never committed. */
  text: string;
  links: SourceUrl[];
};

export function parsePage(html: string, pageUrl: SourceUrl): ParsedPage {
  const $ = cheerio.load(html);
  const links = new Set<SourceUrl>();
  $("a[href], area[href], frame[src], iframe[src]").each((_, el) => {
    const raw = $(el).attr("href") ?? $(el).attr("src");
    const url = raw ? normalizeUrl(raw, pageUrl) : undefined;
    if (url && url !== pageUrl) links.add(url);
  });

  $("script, style, noscript").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  const title = $("title").first().text().replace(/\s+/g, " ").trim();

  return { title, text, links: [...links].sort() };
}

export const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");
