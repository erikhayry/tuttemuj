import type { PageExtraction, PageType } from "./entities.ts";
import type { ImageRef } from "./source.ts";

/**
 * Words our own summaries use for a page without content of its own (the skill tells the analyst to
 * use them). Only trusted when the page also has no people, places or events.
 */
const NO_CONTENT =
  /nästan tom|tom (bild|meny)?sida|ingen egen text|utan (egen )?text|ramsida|rubriksida|logotyp|menysida|innehållsförteckning|^meny\b|navigationssida/i;
/** Of those, the ones that list links to other pages. */
const MENU = /meny|innehållsförteckning|navigationssida|rubriksida/i;

type PageFacts = Pick<PageExtraction, "summary" | "people" | "places" | "events">;

/**
 * "empty" or "menu" when the summary says the page has no content of its own and no facts were
 * found; otherwise undefined. A rule on our own summary, so it needs no AI and can be re-run.
 */
export const noContentPageType = (
  page: PageFacts,
): Extract<PageType, "empty" | "menu"> | undefined =>
  page.people.length + page.places.length + page.events.length === 0 &&
  NO_CONTENT.test(page.summary)
    ? MENU.test(page.summary)
      ? "menu"
      : "empty"
    : undefined;

/** Page types that are left out of search and the buttons, and not re-extracted on a version bump. */
export const NO_CONTENT_PAGE_TYPES: ReadonlySet<PageType> = new Set(["empty", "menu"]);

/** True for pages with nothing of their own to show: empty pages, frames and menus. */
export const isNoContentPage = (page: PageFacts & Pick<PageExtraction, "pageType">): boolean =>
  page.pageType !== undefined
    ? NO_CONTENT_PAGE_TYPES.has(page.pageType)
    : noContentPageType(page) !== undefined;

/** Logos, buttons, arrows, headers and backgrounds, judged by file name. */
const DECORATION =
  /(^|[^a-zåäö])(logo|logotyp|knapp|button|banner|rubrik|meny|menu|bakgrund|background|titel|arrow|pil)([^a-zåäö]|$)/i;

/**
 * True for images that are page decoration (a logo, a header, a button) rather than a picture worth
 * showing. Judged by file name only, so images are never downloaded. Not by alt text: on this site
 * it is usually a caption ("Jangsters logo ritad av…" is a drawing). Not by shape either: wide
 * images here are mostly panoramas and class photos. Small images and thin strips are already
 * dropped by size when the page is crawled. What a picture shows is `ImageFact.kind`.
 */
export const isDecorativeImage = (image: Pick<ImageRef, "url">): boolean =>
  DECORATION.test(image.url.slice(image.url.lastIndexOf("/") + 1));
