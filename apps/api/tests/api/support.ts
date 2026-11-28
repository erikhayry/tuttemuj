import { ButtonId } from "@tuttemuj/schema";

// Shared by the feature and property tests: where the tests stand, and what a valid answer looks like.

/** Torget in Nykarleby, from `data/sources/manual-places.json`. The fixture (#63) puts places around it. */
export const TORGET = { lat: 63.522438, lng: 22.528594 } as const;

/** Every result that links to a page must link here. */
export const SOURCE_HOST = "www.nykarlebyvyer.nu";

/** The 10 button ids in the order the API lists them. */
export const BUTTON_IDS = ButtonId.literals;

/**
 * Our own titles and summaries are short. A longer text field would mean page text leaked into
 * the API (CLAUDE.md: never republish page text). 500 matches the longest text we accept elsewhere.
 */
export const MAX_TEXT_LENGTH = 500;

/** Builds a query string, leaving out keys whose value is `undefined`. Numbers become text. */
export const queryString = (params: Record<string, unknown>): string =>
  new URLSearchParams(
    Object.entries(params).flatMap(([key, value]) =>
      value === undefined ? [] : [[key, String(value)]],
    ),
  ).toString();
