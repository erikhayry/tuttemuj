import { readFile } from "node:fs/promises";
import { Schema } from "effect";
import { IMAGE_QUESTIONS, type ImageQuestion } from "./questions.ts";

const API = "https://api.typesafe.ai/v1/systemone";
/** Pinned, so answers don't shift when `jev-latest` moves. Change it together with the questions. */
export const JEV_MODEL = "jev-1.14.0";

// The part of TypeSafe's response we use. Decoding it (instead of trusting `res.json()`) turns an
// unexpected answer into an error, never into a wrong probability.
const Noul = Schema.Struct({ type: Schema.Literal("noul"), noul: Schema.Number });
const Response = Schema.Struct({
  model: Schema.String,
  answers: Schema.Record(Schema.String, Schema.Unknown),
  usage: Schema.Struct({ input_tokens: Schema.Int }),
});

export type JevAnswers = { [K in ImageQuestion]: number } & { model: string; tokens: number };

/** Ask the image questions about one prepared JPEG. Throws on any API error, never guesses. */
export async function askAboutImage(apiKey: string, jpegPath: string): Promise<JevAnswers> {
  const request = {
    model: JEV_MODEL,
    // The image is uploaded once as a multipart file and referred to by name in the state.
    state: { image: "photo-ref" },
    assets: { "photo-ref": { type: "image", part: "photo" } },
    questions: IMAGE_QUESTIONS,
  };
  const form = new FormData();
  form.append("request", new Blob([JSON.stringify(request)], { type: "application/json" }));
  form.append("photo", new Blob([await readFile(jpegPath)], { type: "image/jpeg" }), "photo.jpg");
  const res = await fetch(API, {
    method: "POST",
    // Images are an opt-in, not yet production-ready TypeSafe feature (docs.typesafe.ai/images).
    headers: { authorization: `Bearer ${apiKey}`, "TypeSafe-Danger-Zone-Images": "true" },
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`TypeSafe ${res.status}: ${text.slice(0, 300)}`);
  const body = Schema.decodeUnknownSync(Response)(JSON.parse(text));
  const noul = (q: ImageQuestion) => Schema.decodeUnknownSync(Noul)(body.answers[q]).noul;
  return {
    photo: noul("photo"),
    buildingVisible: noul("buildingVisible"),
    peopleVisible: noul("peopleVisible"),
    peopleSubject: noul("peopleSubject"),
    model: body.model,
    tokens: body.usage.input_tokens,
  };
}
