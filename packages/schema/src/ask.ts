import { z } from "zod";
import { GeoPoint } from "./gazetteer.ts";
import { SourceUrl } from "./source.ts";

/** Languages the app answers in. Sources are always Swedish. */
export const Lang = z.enum(["sv", "fi", "en"]);
export type Lang = z.infer<typeof Lang>;

/** Body of POST /ask. Location is optional: a question can be asked from anywhere. */
export const AskRequest = z
  .object({
    question: z.string().trim().min(3).max(500),
    lat: GeoPoint.shape.lat.optional(),
    lng: GeoPoint.shape.lng.optional(),
    lang: Lang.default("sv"),
  })
  .refine((r) => (r.lat === undefined) === (r.lng === undefined), {
    message: "lat and lng go together",
    path: ["lat"],
  });
export type AskRequest = z.infer<typeof AskRequest>;

/** A page an answer is built from: our own title and the link to the original. */
export const AskSource = z.object({
  /** The number used as [n] in the answer. */
  n: z.int().positive(),
  sourceUrl: SourceUrl,
  title: z.string(),
});
export type AskSource = z.infer<typeof AskSource>;

/**
 * Response of POST /ask. `answer` cites sources as [n]. When the facts do not answer the
 * question, `grounded` is false, `answer` says so, and `suggestions` are the nearest pages.
 * Never contains page text.
 */
export const AskResponse = z.object({
  answer: z.string(),
  grounded: z.boolean(),
  sources: z.array(AskSource),
  suggestions: z.array(z.object({ sourceUrl: SourceUrl, title: z.string() })),
});
export type AskResponse = z.infer<typeof AskResponse>;
