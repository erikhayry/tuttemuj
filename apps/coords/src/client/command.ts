import { CoordsIgnoreResponse, CoordsNextResponse, CoordsSaveResponse } from "@tuttemuj/schema";
import { Effect, Schema } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";
import { Command, Http } from "foldkit";
import { Message } from "./message.ts";

/** POST JSON to the local server and check the answer with the schema the server built it from. */
const postJson = <A, I>(path: string, body: unknown, schema: Schema.Codec<A, I>) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    const response = yield* client.execute(
      HttpClientRequest.post(`/api${path}`).pipe(HttpClientRequest.bodyJsonUnsafe(body)),
    );
    if (response.status !== 200) return yield* Effect.fail(new Error(`HTTP ${response.status}`));
    return yield* Schema.decodeUnknownEffect(schema)(yield* response.json);
  });

export const LoadNext = Command.define("LoadNext", {
  args: { skipped: Schema.Array(Schema.String) },
  messages: [Message.SucceededLoadNext, Message.FailedLoadNext],
  execute: (body) =>
    postJson("/next", body, CoordsNextResponse).pipe(
      Effect.map((response) => Message.SucceededLoadNext({ response })),
      Effect.catch(() => Effect.succeed(Message.FailedLoadNext())),
      Effect.provide(Http.layer),
    ),
});

export const Save = Command.define("Save", {
  args: { name: Schema.String, input: Schema.String },
  messages: [Message.SucceededSave, Message.RejectedSave, Message.FailedSave],
  execute: (body) =>
    postJson("/save", body, CoordsSaveResponse).pipe(
      Effect.map((response) =>
        response.result === "saved"
          ? Message.SucceededSave({ name: response.name, location: response.location })
          : Message.RejectedSave({ reason: response.reason }),
      ),
      Effect.catch(() => Effect.succeed(Message.FailedSave())),
      Effect.provide(Http.layer),
    ),
});

export const Ignore = Command.define("Ignore", {
  args: { name: Schema.String },
  messages: [Message.SucceededIgnore, Message.FailedSave],
  execute: (body) =>
    postJson("/ignore", body, CoordsIgnoreResponse).pipe(
      Effect.map(({ name }) => Message.SucceededIgnore({ name })),
      Effect.catch(() => Effect.succeed(Message.FailedSave())),
      Effect.provide(Http.layer),
    ),
});
