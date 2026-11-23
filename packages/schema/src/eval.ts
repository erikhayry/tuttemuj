import { z } from "zod";
import { Lang } from "./ask.ts";
import { GeoPoint } from "./gazetteer.ts";
import { SourceUrl } from "./source.ts";

/**
 * One question in the retrieval eval set (data/eval/questions.json). `relevant` are pages that
 * would answer it well: any of them in the top results counts. Written by hand from the data, so
 * a page missing from the list is not proof that it is a bad result. Never page text.
 */
export const EvalCase = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  question: z.string().min(3),
  lang: Lang,
  /** Where the user stands, for questions like "what happened here?". */
  lat: GeoPoint.shape.lat.optional(),
  lng: GeoPoint.shape.lng.optional(),
  relevant: z.array(SourceUrl).min(1),
  /** Why these pages, and what to watch for. */
  note: z.string().optional(),
});
export type EvalCase = z.infer<typeof EvalCase>;

export const EvalSet = z
  .array(EvalCase)
  .refine((cases) => new Set(cases.map((c) => c.id)).size === cases.length, {
    message: "eval case ids must be unique",
  });
export type EvalSet = z.infer<typeof EvalSet>;
