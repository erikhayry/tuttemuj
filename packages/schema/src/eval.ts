import { Schema } from "effect";
import { Lang } from "./ask.ts";
import { ArrayWithDefault } from "./defaults.ts";
import { GeoPoint } from "./gazetteer.ts";
import { SourceUrl } from "./source.ts";

const Slug = Schema.String.check(Schema.isPattern(/^[a-z0-9]+(-[a-z0-9]+)*$/));

/**
 * One question in the retrieval eval set (data/eval/questions.json). `relevant` are pages that
 * would answer it well: any of them in the top results counts. Judged by hand (the review page,
 * `pnpm --filter @tuttemuj/api run review`), so a page in neither list is simply not judged yet.
 * A case with nothing marked relevant is left out of the scores. Never page text.
 */
export const EvalCase = Schema.Struct({
  id: Slug,
  question: Schema.String.check(Schema.isMinLength(3)),
  lang: Lang,
  /** Where the user stands, for questions like "what happened here?". */
  lat: Schema.optionalKey(GeoPoint.fields.lat),
  lng: Schema.optionalKey(GeoPoint.fields.lng),
  relevant: ArrayWithDefault(SourceUrl),
  /** Pages someone looked at and judged a bad answer. Not listed in either: not judged yet. */
  irrelevant: ArrayWithDefault(SourceUrl),
  /** Why these pages, and what to watch for. */
  note: Schema.optionalKey(Schema.String),
});
export type EvalCase = typeof EvalCase.Type;

export const EvalSet = Schema.Array(EvalCase).check(
  Schema.makeFilter(
    (cases) =>
      new Set(cases.map((c) => c.id)).size === cases.length || "eval case ids must be unique",
  ),
);
export type EvalSet = typeof EvalSet.Type;
