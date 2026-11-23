import { NearbyQuery, NearbyResponse } from "@tuttemuj/schema";
import { Hono } from "hono";
import { type NearbySource, nearby } from "./nearby.ts";

export function createApp(source: NearbySource) {
  const app = new Hono();

  app.get("/health", (c) => c.json({ ok: true }));

  // Places around a point, with the pages that mention them. Links back to the original site.
  app.get("/nearby", async (c) => {
    const query = NearbyQuery.safeParse(c.req.query());
    if (!query.success) {
      return c.json({ error: "invalid query", issues: query.error.issues }, 400);
    }
    return c.json(NearbyResponse.parse(await nearby(source, query.data)));
  });

  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: "internal error" }, 500);
  });

  return app;
}
