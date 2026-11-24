import { ButtonId, ButtonResultsResponse, ButtonsResponse } from "@tuttemuj/schema";
import { Effect, Schema } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";
import { Command, Http } from "foldkit";
import { Message } from "./message.ts";
import type { Position } from "./model.ts";

// COMMANDS

/** Ask the browser for the position. The browser shows its own permission prompt. */
export const Locate = Command.define("Locate", {
  messages: [Message.SucceededLocate, Message.FailedLocate],
  // `Effect.callback` wraps a callback API (here `getCurrentPosition`) as an Effect, like `new Promise`.
  execute: Effect.callback<
    ReturnType<typeof Message.SucceededLocate> | ReturnType<typeof Message.FailedLocate>
  >((resume) => {
    if (!navigator.geolocation) {
      resume(Effect.succeed(Message.FailedLocate({ reason: "unavailable" })));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resume(
          Effect.succeed(
            Message.SucceededLocate({
              position: { lat: p.coords.latitude, lng: p.coords.longitude },
            }),
          ),
        ),
      (e) =>
        resume(
          Effect.succeed(
            Message.FailedLocate({
              // PERMISSION_DENIED is code 1; timeouts and "no position" are "unavailable".
              reason: e.code === e.PERMISSION_DENIED ? "denied" : "unavailable",
            }),
          ),
        ),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  }),
});

// The API is the Effect server in apps/api (`/api` is forwarded to it, see vite.config.ts).
const API = "/api";

/** GET a path and check the answer with a Schema: the same one the server used to build it. */
const getJson = <A, I>(path: string, params: Record<string, string>, schema: Schema.Codec<A, I>) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    const response = yield* client.execute(
      HttpClientRequest.get(`${API}${path}`).pipe(HttpClientRequest.setUrlParams(params)),
    );
    if (response.status !== 200) return yield* Effect.fail(new Error(`HTTP ${response.status}`));
    return yield* Schema.decodeUnknownEffect(schema)(yield* response.json);
  });

const positionParams = ({ lat, lng }: Position) => ({ lat: String(lat), lng: String(lng) });

export const LoadButtons = Command.define("LoadButtons", {
  args: { lat: Schema.Number, lng: Schema.Number },
  messages: [Message.SucceededLoadButtons, Message.FailedLoadButtons],
  execute: (position) =>
    getJson("/buttons", { ...positionParams(position), radius: "200" }, ButtonsResponse).pipe(
      // The API answers 400 for a position outside Nykarleby. For the user that is simply "nothing
      // here", not an error, so it becomes an empty list of buttons.
      Effect.catchIf(
        (e) => e instanceof Error && e.message === "HTTP 400",
        () => Effect.succeed({ buttons: [] }),
      ),
      Effect.map((response) => Message.SucceededLoadButtons({ response })),
      Effect.catch(() => Effect.succeed(Message.FailedLoadButtons())),
      Effect.provide(Http.layer),
    ),
});

export const LoadResults = Command.define("LoadResults", {
  args: { id: ButtonId, lat: Schema.Number, lng: Schema.Number },
  messages: [Message.SucceededLoadResults, Message.FailedLoadResults],
  execute: ({ id, ...position }) =>
    getJson(
      `/buttons/${id}`,
      { ...positionParams(position), radius: "200" },
      ButtonResultsResponse,
    ).pipe(
      Effect.map((response) => Message.SucceededLoadResults({ response })),
      Effect.catch(() => Effect.succeed(Message.FailedLoadResults())),
      Effect.provide(Http.layer),
    ),
});
