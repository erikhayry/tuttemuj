import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "@tuttemuj/schema";
import { Schema } from "effect";

const Response = Schema.Struct({
  data: Schema.Array(Schema.Struct({ index: Schema.Int, embedding: Schema.Array(Schema.Number) })),
  usage: Schema.Struct({ total_tokens: Schema.Int }),
});

export type Embedded = { vectors: ReadonlyArray<ReadonlyArray<number>>; tokens: number };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Embed texts with Voyage. `document` for things we store, `query` for a user's question.
 * Retries rate limits (429) and server errors with a growing pause.
 */
export async function embed(
  apiKey: string,
  texts: string[],
  inputType: "document" | "query",
): Promise<Embedded> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        input: texts,
        model: EMBEDDING_MODEL,
        input_type: inputType,
        output_dimension: EMBEDDING_DIMENSIONS,
      }),
    });
    if (res.ok) {
      const body = Schema.decodeUnknownSync(Response)(await res.json());
      const vectors = [...body.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
      if (
        vectors.length !== texts.length ||
        vectors.some((v) => v.length !== EMBEDDING_DIMENSIONS)
      ) {
        throw new Error("Voyage returned an unexpected number of vectors or dimensions");
      }
      return { vectors, tokens: body.usage.total_tokens };
    }
    const retry = res.status === 429 || res.status >= 500;
    if (!retry || attempt >= 30) {
      throw new Error(`Voyage ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const wait = Math.min(60_000, 5_000 * 2 ** (attempt - 1));
    console.log(`Voyage ${res.status}, waiting ${wait / 1000}s (attempt ${attempt})`);
    await sleep(wait);
  }
}
