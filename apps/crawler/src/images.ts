import type { ImageRef, SourceUrl } from "@tuttemuj/schema";
import type { CheerioAPI } from "cheerio";
import { normalizeImageUrl } from "./url.ts";

/** Shorter side and area limits: drops icons and arrows (by area) and thin strips like scale bars (by side). */
const MIN_SIDE = 150;
const MIN_AREA = 200 * 200;
/** A thumbnail that links to a larger version is kept if it is at least this big. */
const MIN_THUMB_SIDE = 50;

/** Parse an HTML size attribute. Percentages and junk give undefined. */
const px = (value: string | undefined): number | undefined => {
  const m = value?.trim().match(/^(\d+)(px)?$/i);
  const n = m ? Number(m[1]) : 0;
  return n > 0 ? n : undefined;
};

export const isLargeImage = (width: number, height: number): boolean =>
  Math.min(width, height) >= MIN_SIDE && width * height >= MIN_AREA;

/** References to the large images on a page, judged only by their declared width/height. */
export function findImages($: CheerioAPI, pageUrl: SourceUrl): ImageRef[] {
  const images = new Map<SourceUrl, ImageRef>();
  $("img[src]").each((_, el) => {
    const img = $(el);
    const url = normalizeImageUrl(img.attr("src") ?? "", pageUrl);
    const width = px(img.attr("width"));
    const height = px(img.attr("height"));
    if (!url || !width || !height || images.has(url)) return;

    const href = img.closest("a[href]").attr("href");
    const fullUrl = href ? normalizeImageUrl(href, pageUrl) : undefined;
    const keep =
      isLargeImage(width, height) || (fullUrl && Math.min(width, height) >= MIN_THUMB_SIDE);
    if (!keep) return;

    const alt = (img.attr("alt") ?? img.attr("title"))?.replace(/\s+/g, " ").trim();
    images.set(url, {
      url,
      width,
      height,
      ...(alt ? { alt } : {}),
      ...(fullUrl && fullUrl !== url ? { fullUrl } : {}),
    });
  });
  return [...images.values()];
}
