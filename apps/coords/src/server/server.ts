/** The coords tool: `pnpm coords`, then open the printed address. Writes to data/sources. */
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";
import { createServer as createViteServer } from "vite";
import { CoordsApi } from "./api.ts";
import { CoordsData } from "./data.ts";
import { env } from "./env.ts";
import { CoordsHandlers } from "./handlers.ts";

const Api = HttpRouter.serve(
  HttpApiBuilder.layer(CoordsApi).pipe(
    Layer.provide(CoordsHandlers),
    Layer.provide(CoordsData.layer(env.DATA_DIR)),
  ),
).pipe(
  Layer.provide(
    NodeHttpServer.layer(createServer, { port: env.COORDS_API_PORT, host: "127.0.0.1" }),
  ),
);

// Vite serves the page from this same process, so one command starts the whole tool.
// `acquireRelease` pairs opening something with closing it when the program stops, like the
// cleanup function of a React `useEffect`.
const Page = Layer.effectDiscard(
  Effect.acquireRelease(
    Effect.promise(async () => {
      const vite = await createViteServer({
        root: fileURLToPath(new URL("../..", import.meta.url)),
      });
      await vite.listen();
      vite.printUrls();
      return vite;
    }),
    (vite) => Effect.promise(() => vite.close()),
  ),
);

// `Layer.provide` here orders the start: the API is up before the page is announced.
Layer.launch(Page.pipe(Layer.provide(Api))).pipe(NodeRuntime.runMain);
