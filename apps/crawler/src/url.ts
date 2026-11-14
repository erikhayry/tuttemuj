import { SOURCE_ORIGIN, type SourceUrl } from "@tuttemuj/schema";

const SITE_HOSTS = new Set(["www.nykarlebyvyer.nu", "nykarlebyvyer.nu"]);
const PAGE_EXT = /\.html?$/i;
/** Site pages that are not content (error pages, frame chrome). */
const IGNORED_PATHS = [/^\/notfound\.html$/i];

/**
 * Resolve an href against its page and normalize it to a canonical source URL.
 * Returns undefined for anything we should not crawl (other hosts, images, mailto...).
 */
export function normalizeUrl(href: string, base: string = SOURCE_ORIGIN): SourceUrl | undefined {
  const trimmed = href.trim();
  if (!trimmed || /^(mailto|javascript|tel):/i.test(trimmed)) return undefined;

  let url: URL;
  try {
    url = new URL(trimmed, base);
  } catch {
    return undefined;
  }
  if (!/^https?:$/.test(url.protocol) || !SITE_HOSTS.has(url.hostname.toLowerCase())) {
    return undefined;
  }
  // The server is case-sensitive (e.g. kortindi/*.HTM), so path case is preserved.
  const path = url.pathname.replace(/\/{2,}/g, "/");
  if (!PAGE_EXT.test(path) || IGNORED_PATHS.some((re) => re.test(path))) return undefined;

  return `${SOURCE_ORIGIN}${path}`;
}

const IMAGE_EXT = /\.(jpe?g|png|gif|webp)$/i;

/** Like normalizeUrl, but for image files on the site. */
export function normalizeImageUrl(src: string, base: string): SourceUrl | undefined {
  let url: URL;
  try {
    url = new URL(src.trim(), base);
  } catch {
    return undefined;
  }
  if (!/^https?:$/.test(url.protocol) || !SITE_HOSTS.has(url.hostname.toLowerCase())) {
    return undefined;
  }
  const path = url.pathname.replace(/\/{2,}/g, "/");
  return IMAGE_EXT.test(path) ? `${SOURCE_ORIGIN}${path}` : undefined;
}

/** Lower number = crawled earlier. Place-related sections first, for "what happened here?". */
const PRIORITIES: Array<[RegExp, number]> = [
  [/^\/sidor\/texter\/(hus|gatunamn|vandring|brunnar)\//i, 0],
  [/^\/sidor\/karta\//i, 0],
  [/^\/sidor\/texter\/(pers|fakta|krono|1808|socken|protokoll)\//i, 1],
  [/^\/sidor\/(kortindi|minnesst|nykarleb|panorama)\//i, 1],
  [/^\/sidor\/texter\/(diverse|bidrag|upp|fartyg|hskr)\//i, 2],
  [/^\/sidor\/texter\/prosa\//i, 3],
  [/^\/sidor\/(menyer|nyheter)\//i, 4],
  [/^\/sidor\/texter\/poesi\//i, 5],
];

export function crawlPriority(url: SourceUrl): number {
  const path = new URL(url).pathname;
  return PRIORITIES.find(([re]) => re.test(path))?.[1] ?? 3;
}
