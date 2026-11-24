import { Schema } from "effect";
import { IsoDateTime, SourceUrl } from "./source.ts";

/**
 * Bump when the image questions (apps/crawler/src/images/questions.ts) change, so every image is
 * asked again. Record the change in docs/images.md.
 */
export const IMAGE_QUESTIONS_VERSION = 1;

/** A probability from 0 to 1, as TypeSafe returns it for a yes/no question. */
const Probability = Schema.Number.check(Schema.isBetween({ minimum: 0, maximum: 1 }));

/** What Jev answered about one image. Only probabilities: the image itself is never stored. */
export const ImageClassified = Schema.Struct({
  url: SourceUrl,
  /** Is it a photograph (not a drawing, map, logo, heading or scanned page)? */
  photo: Probability,
  /** Is a building visible anywhere, even small or in the background? */
  buildingVisible: Probability,
  /** Are people visible anywhere, even small or in the background? */
  peopleVisible: Probability,
  /** Are the people what the photo is about (a portrait or group photo)? */
  peopleSubject: Probability,
  model: Schema.String,
  questionsVersion: Schema.Int.check(Schema.isGreaterThan(0)),
  classifiedAt: IsoDateTime,
});
export type ImageClassified = typeof ImageClassified.Type;

/** An image that was not sent to Jev, and why. Kept so it is not tried again every night. */
export const ImageSkipped = Schema.Struct({
  url: SourceUrl,
  skipped: Schema.Literals([
    /** A logo, header or button by file name (`isDecorativeImage`). Never fetched. */
    "decorative",
    /** The site returned an error or the image could not be read. */
    "fetch-failed",
    /** Not a JPEG/PNG/GIF that could be converted, or outside TypeSafe's size limits. */
    "unsupported",
  ]),
  detail: Schema.optionalKey(Schema.String),
  questionsVersion: Schema.Int.check(Schema.isGreaterThan(0)),
  classifiedAt: IsoDateTime,
});
export type ImageSkipped = typeof ImageSkipped.Type;

// `Schema.Union` is Zod's `z.union`: a row is either shape. Decoding tries each member in turn, and
// TypeScript narrows on `"skipped" in row`.
/** One row of data/images.jsonl. */
export const ImageClassification = Schema.Union([ImageClassified, ImageSkipped]);
export type ImageClassification = typeof ImageClassification.Type;

/** A yes is above this, a no below 1 minus it; in between the question is not settled. */
const YES = 0.7;

/**
 * Shown in "Visa gamla bilder härifrån": a photograph with a building or people in it. Tested on 60
 * hand-labelled images (docs/images.md): right on all 30 that the wording was not tuned on.
 */
export const isShowableImage = (c: ImageClassification): boolean =>
  !("skipped" in c) && c.photo > YES && (c.buildingVisible > YES || c.peopleVisible > YES);

/** Jev could not tell whether it is a photo. Hidden until a person has looked at it. */
export const needsImageReview = (c: ImageClassification): boolean =>
  !("skipped" in c) && c.photo >= 1 - YES && c.photo <= YES;
