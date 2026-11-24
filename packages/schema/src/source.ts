import { Schema } from "effect";

/** Only pages on the original site are tracked. */
export const SOURCE_ORIGIN = "https://www.nykarlebyvyer.nu";

/** An ISO 8601 UTC timestamp, e.g. "2026-11-14T00:00:00Z" (same rule as Zod's `z.iso.datetime()`). */
export const IsoDateTime = Schema.String.check(
  Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/, {
    description: "an ISO 8601 UTC timestamp",
  }),
);

// Effect: validation is added with `.check(filter)` instead of Zod's chained methods
// (`.regex()`, `.min()`). `isPattern` is `.regex()`; filters can be stacked in one `.check(a, b)`.
export const SourceUrl = Schema.String.check(
  Schema.isPattern(/^https:\/\/www\.nykarlebyvyer\.nu(?:[/?#]\S*)?$/, {
    description: "an https URL on www.nykarlebyvyer.nu",
  }),
).annotate({ description: "Normalized absolute URL on nykarlebyvyer.nu" });
export type SourceUrl = typeof SourceUrl.Type;

/** A large image on a source page. Only a reference: images are never downloaded or rehosted. */
export const ImageRef = Schema.Struct({
  url: SourceUrl,
  /** Size as declared by the page's <img width height>. */
  width: Schema.Int.check(Schema.isGreaterThan(0)),
  height: Schema.Int.check(Schema.isGreaterThan(0)),
  // `optionalKey`: the key may be missing (Zod `.optional()`, but `undefined` is not accepted).
  alt: Schema.optionalKey(Schema.String),
  /** Larger version, when the image is wrapped in <a href="...jpg">. */
  fullUrl: Schema.optionalKey(SourceUrl),
});
export type ImageRef = typeof ImageRef.Type;

export const FrontierStatus = Schema.Literals(["pending", "fetched", "failed", "gone"]);
export type FrontierStatus = typeof FrontierStatus.Type;

// `Schema.Int` already means "integer"; extra rules are stacked on with `.check`.
const NonNegativeInt = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

/** One URL in the crawl frontier (data/frontier.jsonl). */
export const FrontierEntry = Schema.Struct({
  url: SourceUrl,
  status: FrontierStatus,
  discoveredAt: IsoDateTime,
  discoveredFrom: Schema.optionalKey(SourceUrl),
  attempts: NonNegativeInt,
  lastAttemptAt: Schema.optionalKey(IsoDateTime),
  httpStatus: Schema.optionalKey(Schema.Int),
  /** sha256 of the decoded page content, used for change detection. */
  contentHash: Schema.optionalKey(Schema.String),
  lastModified: Schema.optionalKey(Schema.String),
  /** Large images found on the page (small icons, arrows etc. are filtered out). */
  images: Schema.optionalKey(Schema.Array(ImageRef)),
  error: Schema.optionalKey(Schema.String),
});
export type FrontierEntry = typeof FrontierEntry.Type;

/** Summary of one crawl run (data/runs.jsonl). */
export const CrawlRun = Schema.Struct({
  startedAt: IsoDateTime,
  finishedAt: IsoDateTime,
  attempted: NonNegativeInt,
  fetched: NonNegativeInt,
  gone: NonNegativeInt,
  failed: NonNegativeInt,
  discovered: NonNegativeInt,
  pendingAfter: NonNegativeInt,
});
export type CrawlRun = typeof CrawlRun.Type;
