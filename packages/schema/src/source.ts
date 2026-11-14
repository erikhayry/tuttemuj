import { z } from "zod";

/** Only pages on the original site are tracked. */
export const SOURCE_ORIGIN = "https://www.nykarlebyvyer.nu";

export const SourceUrl = z
  .url({ protocol: /^https$/, hostname: /^www\.nykarlebyvyer\.nu$/ })
  .describe("Normalized absolute URL on nykarlebyvyer.nu");
export type SourceUrl = z.infer<typeof SourceUrl>;

/** A large image on a source page. Only a reference: images are never downloaded or rehosted. */
export const ImageRef = z.object({
  url: SourceUrl,
  /** Size as declared by the page's <img width height>. */
  width: z.int().positive(),
  height: z.int().positive(),
  alt: z.string().optional(),
  /** Larger version, when the image is wrapped in <a href="...jpg">. */
  fullUrl: SourceUrl.optional(),
});
export type ImageRef = z.infer<typeof ImageRef>;

export const FrontierStatus = z.enum(["pending", "fetched", "failed", "gone"]);
export type FrontierStatus = z.infer<typeof FrontierStatus>;

/** One URL in the crawl frontier (data/frontier.jsonl). */
export const FrontierEntry = z.object({
  url: SourceUrl,
  status: FrontierStatus,
  discoveredAt: z.iso.datetime(),
  discoveredFrom: SourceUrl.optional(),
  attempts: z.int().nonnegative(),
  lastAttemptAt: z.iso.datetime().optional(),
  httpStatus: z.int().optional(),
  /** sha256 of the decoded page content, used for change detection. */
  contentHash: z.string().optional(),
  lastModified: z.string().optional(),
  /** Large images found on the page (small icons, arrows etc. are filtered out). */
  images: z.array(ImageRef).optional(),
  error: z.string().optional(),
});
export type FrontierEntry = z.infer<typeof FrontierEntry>;

/** Summary of one crawl run (data/runs.jsonl). */
export const CrawlRun = z.object({
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime(),
  attempted: z.int().nonnegative(),
  fetched: z.int().nonnegative(),
  gone: z.int().nonnegative(),
  failed: z.int().nonnegative(),
  discovered: z.int().nonnegative(),
  pendingAfter: z.int().nonnegative(),
});
export type CrawlRun = z.infer<typeof CrawlRun>;
