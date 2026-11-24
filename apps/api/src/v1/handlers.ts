import type { ButtonId, ButtonQuery, ButtonResult } from "@tuttemuj/schema";
import { type Context, Effect, Schema } from "effect";
import { HttpApiBuilder } from "effect/http-api";
import { Api } from "./api.ts";
import { BUTTON_ORDER, BUTTONS, rpcArgs, todayInFinland } from "./buttons.ts";
import { Db } from "./db.ts";

type DbShape = Context.Service.Shape<typeof Db>;

/** Call one button's function and turn its rows into results. */
const runButton = Effect.fn("runButton")(function* (db: DbShape, id: ButtonId, q: ButtonQuery) {
  const spec = BUTTONS[id];
  const rows = yield* db.rpc(spec.fn, rpcArgs(id, q));
  // Check the rows from the database before trusting them (an I/O boundary).
  const checked = yield* Schema.decodeUnknownEffect(Schema.Array(spec.row))(rows);
  return checked.map((row): ButtonResult => spec.map(row));
});

// `HttpApiBuilder.group` implements one group of the API definition. The handler for each endpoint
// receives the already validated `query` and `params`; a bad request never gets this far.
// A database or data problem is a bug, not something the caller can fix, so `Effect.orDie` turns it
// into a 500 (Effect's "defect": a failure that is not part of the typed error channel).
export const PlacesHandlers = HttpApiBuilder.group(
  Api,
  "places",
  Effect.fn(function* (handlers) {
    // The group asks for `Db` once, when it is built; server.ts provides it.
    const db = yield* Db;
    return handlers.handle("near", ({ query }) =>
      runButton(db, "nearby", { ...query, limit: 50 }).pipe(
        Effect.map((results) => ({
          places: results.flatMap((r) => (r.button === "nearby" ? [r] : [])),
        })),
        Effect.orDie,
      ),
    );
  }),
);

export const ButtonsHandlers = HttpApiBuilder.group(
  Api,
  "buttons",
  Effect.fn(function* (handlers) {
    const db = yield* Db;
    return handlers
      .handle("results", ({ params, query }) =>
        runButton(db, params.id, query).pipe(
          Effect.map((results) => ({ button: params.id, results })),
          Effect.orDie,
        ),
      )
      .handle("list", ({ query }) =>
        // The counts come from one database function, so the buttons are decided in one place.
        Effect.gen(function* () {
          const today = todayInFinland();
          const rows = yield* db.rpc("button_counts", {
            in_lat: query.lat,
            in_lng: query.lng,
            in_radius_m: query.radius,
            in_month: query.month ?? today.month,
            in_day: query.day ?? today.day,
            in_limit: query.limit,
          });
          const counts = yield* Schema.decodeUnknownEffect(
            Schema.Array(Schema.Struct({ button_id: Schema.String, result_count: Schema.Int })),
          )(rows);
          const byId = new Map(counts.map((c) => [c.button_id, c.result_count]));
          return {
            buttons: BUTTON_ORDER.flatMap((button) => {
              const count = byId.get(button);
              return count ? [{ button, count }] : [];
            }),
          };
        }).pipe(Effect.orDie),
      );
  }),
);

export const SystemHandlers = HttpApiBuilder.group(
  Api,
  "system",
  Effect.fn(function* (handlers) {
    return handlers.handle("health", () => Effect.void);
  }),
);
