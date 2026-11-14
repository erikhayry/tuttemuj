import { z } from "zod";

/** Only pages on the original site are tracked. */
export const SOURCE_ORIGIN = "https://www.nykarlebyvyer.nu";

export const SourceUrl = z
  .url({ protocol: /^https$/, hostname: /^www\.nykarlebyvyer\.nu$/ })
  .describe("Normalized absolute URL on nykarlebyvyer.nu");
export type SourceUrl = z.infer<typeof SourceUrl>;

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
  error: z.string().optional(),
});
export type FrontierEntry = z.infer<typeof FrontierEntry>;
