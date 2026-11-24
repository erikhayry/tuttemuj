import { Effect, Schema } from "effect";
import { GeoPoint } from "./gazetteer.ts";
import { SourceUrl } from "./source.ts";

/** Languages the app answers in. Sources are always Swedish. */
export const Lang = Schema.Literals(["sv", "fi", "en"]);
export type Lang = typeof Lang.Type;

/** Body of POST /ask. Location is optional: a question can be asked from anywhere. */
export const AskRequest = Schema.Struct({
  // `Schema.Trim` decodes by trimming the string (Zod: `.trim()`); the length checks run on the result.
  question: Schema.Trim.check(Schema.isMinLength(3), Schema.isMaxLength(500)),
  lat: Schema.optionalKey(GeoPoint.fields.lat),
  lng: Schema.optionalKey(GeoPoint.fields.lng),
  // Missing `lang` decodes to "sv". `.pipe(f)` is how Effect applies a modifier: `f(Lang)`.
  lang: Lang.pipe(Schema.withDecodingDefaultKey(Effect.succeed("sv" as const))),
}).check(
  Schema.makeFilter(
    (r) => (r.lat === undefined) === (r.lng === undefined) || "lat and lng go together",
  ),
);
export type AskRequest = typeof AskRequest.Type;

/** A page an answer is built from: our own title and the link to the original. */
export const AskSource = Schema.Struct({
  /** The number used as [n] in the answer. */
  n: Schema.Int.check(Schema.isGreaterThan(0)),
  sourceUrl: SourceUrl,
  title: Schema.String,
  /** Our own summary of the page. Only set in search mode, where there is no written answer. */
  summary: Schema.optionalKey(Schema.String),
  /** People the page names, as "Name (1850–1920, role)". Only set in search mode. */
  people: Schema.optionalKey(Schema.Array(Schema.String)),
});
export type AskSource = typeof AskSource.Type;

/**
 * Response of POST /ask. In answer mode `answer` cites sources as [n]. When the facts do not answer
 * the question, `grounded` is false, `answer` says so, and `suggestions` are the nearest pages.
 * Never contains page text.
 */
export const AskResponse = Schema.Struct({
  /**
   * "answer": Claude wrote `answer` from the sources. "search": no Claude, `answer` is a one-line
   * intro and `sources` are the best matching pages with our summaries.
   */
  mode: Schema.Literals(["answer", "search"]),
  answer: Schema.String,
  grounded: Schema.Boolean,
  sources: Schema.Array(AskSource),
  suggestions: Schema.Array(Schema.Struct({ sourceUrl: SourceUrl, title: Schema.String })),
});
export type AskResponse = typeof AskResponse.Type;
