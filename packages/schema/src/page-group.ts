import { z } from "zod";
import { SourceUrl } from "./source.ts";

/** Why two pages were judged to show the same thing. */
export const DuplicateEvidence = z.enum([
  /** Same folder, filenames differing only in the last character. */
  "similar-filename",
  /** Both pages show exactly the same images. */
  "same-images",
  /** The titles are equal, or one is the other plus a translation or "(engelsk bildtext)". Extra support only. */
  "same-title",
  /** An English-section page with the same images as a Swedish page. */
  "english-section",
]);
export type DuplicateEvidence = z.infer<typeof DuplicateEvidence>;

/**
 * Pages that repeat each other, e.g. a Swedish caption page and its English twin, or a map and its
 * enlargement (data/entities/page-groups.json). Answers should use the `primary` page's facts once.
 */
export const PageGroup = z.object({
  /** The page to cite and use facts from: the Swedish original, or else the one with most facts. */
  primary: SourceUrl,
  duplicates: z
    .array(
      z.object({
        url: SourceUrl,
        /** "english" for a translation of the primary, "variant" for e.g. a larger or smaller version. */
        kind: z.enum(["english", "variant"]),
        evidence: z.array(DuplicateEvidence).min(1),
      }),
    )
    .min(1),
});
export type PageGroup = z.infer<typeof PageGroup>;
