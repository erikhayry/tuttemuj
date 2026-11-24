/** The v1 API: `pnpm --filter @tuttemuj/api dev:v1` (reads the root .env). No Claude or Voyage calls. */
import { createServer } from "node:http";
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { EnvSecret, EnvUrl, envInt, readEnv } from "@tuttemuj/schema";
import { Layer, Schema } from "effect";
import { HttpRouter } from "effect/http";
import { HttpApiBuilder, HttpApiScalar } from "effect/http-api";
import { Api } from "./api.ts";
import { Db } from "./db.ts";
import { ButtonsHandlers, PlacesHandlers, SystemHandlers } from "./handlers.ts";

const env = readEnv(
  Schema.Struct({
    SUPABASE_URL: EnvUrl,
    SUPABASE_SECRET_KEY: EnvSecret,
    PORT: envInt(8787),
  }),
);

// A Layer describes how to build part of the app and what it needs, like a dependency-injection
// module. They are stacked with `Layer.provide`, and `Layer.launch` runs the finished stack.
const DbLive = Db.layerSupabase(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY);
// Each handler group asks for `Db` when it is built, so `Db` is provided under the groups.
const ApiRoutes = HttpApiBuilder.layer(Api, { openapiPath: "/openapi.json" }).pipe(
  Layer.provide([PlacesHandlers, ButtonsHandlers, SystemHandlers]),
  Layer.provide(DbLive),
);

// Documentation page for the API, generated from the same definition.
const DocsRoute = HttpApiScalar.layer(Api, { path: "/docs" });

const Server = HttpRouter.serve(Layer.mergeAll(ApiRoutes, DocsRoute)).pipe(
  Layer.provide(NodeHttpServer.layer(createServer, { port: env.PORT })),
);

Layer.launch(Server).pipe(NodeRuntime.runMain);
