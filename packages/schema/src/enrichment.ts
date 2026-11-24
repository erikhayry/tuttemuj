import { Schema } from "effect";
import { ArrayWithDefault } from "./defaults.ts";
import {
  ENRICH_VERSION,
  ImageFact,
  type PageExtraction,
  PageType,
  PersonPlaceRelation,
  PlaceUse,
} from "./entities.ts";
import { NO_CONTENT_PAGE_TYPES } from "./no-content.ts";
import { SourceUrl } from "./source.ts";

/**
 * What the analyst adds to one place that is already on the page. `name` must be exactly a name in
 * the page's `places`; the places themselves are never added or changed here.
 */
export const PlaceEnrichmentDraft = Schema.Struct({
  name: Schema.NonEmptyString,
  uses: Schema.optionalKey(Schema.Array(PlaceUse)),
  nameOrigin: Schema.optionalKey(Schema.NonEmptyString),
});
export type PlaceEnrichmentDraft = typeof PlaceEnrichmentDraft.Type;

/**
 * What `/enrich-pages` writes for one page: only the v1 fields (#53), never the old ones. The
 * bookkeeping (`enrichments` stamp) is added by `enrich:save`, like `extract:save` does for pages.
 */
export const PageEnrichmentDraft = Schema.Struct({
  sourceUrl: SourceUrl,
  model: Schema.String,
  /** Always decided. */
  pageType: PageType,
  /** Person and place names must match the page's `people` and `places`. `[]` when none. */
  relations: ArrayWithDefault(PersonPlaceRelation),
  /** Only images the page says something about. Numbers are the `[bild n]` markers. */
  images: ArrayWithDefault(ImageFact),
  /** Only places that have a use or a name origin. */
  places: ArrayWithDefault(PlaceEnrichmentDraft),
});
export type PageEnrichmentDraft = typeof PageEnrichmentDraft.Type;

/** One page handed out for enrichment (.cache/enrich/batch.json). */
export const EnrichmentTask = Schema.Struct({
  sourceUrl: SourceUrl,
  title: Schema.String,
  contentHash: Schema.String,
  textPath: Schema.String,
  draftPath: Schema.String,
  /** How many `[bild n]` markers the text has, so `enrich:save` can check image numbers. */
  imageCount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});
export type EnrichmentTask = typeof EnrichmentTask.Type;

/** Has `/enrich-pages` run on this page with the current (or a newer) version? */
export const isEnriched = (page: Pick<PageExtraction, "enrichments">): boolean =>
  page.enrichments?.some((e) => e.skill === "enrich-pages" && e.version >= ENRICH_VERSION) ?? false;

/**
 * Should `/enrich-pages` do this page? Yes when it has no v1 fields yet (no `pageType`: it was
 * extracted before v1) or an older enrichment. A page with a `pageType` and no stamp came from a
 * full v1-aware extraction and already has everything. Empty pages and menus have nothing to add.
 */
export const needsEnrichment = (
  page: Pick<PageExtraction, "pageType" | "enrichments">,
): boolean => {
  if (page.pageType !== undefined && NO_CONTENT_PAGE_TYPES.has(page.pageType)) return false;
  if (isEnriched(page)) return false;
  return page.pageType === undefined || (page.enrichments?.length ?? 0) > 0;
};
