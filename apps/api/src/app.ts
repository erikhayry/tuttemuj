import { AskRequest, AskResponse, NearbyQuery, NearbyResponse, safeDecode } from "@tuttemuj/schema";
import { Schema } from "effect";
import { Hono } from "hono";
import { type NearbySource, nearby } from "./nearby.ts";

export type Deps = {
  nearby: NearbySource;
  /** Answers a question. Missing when the Voyage or Anthropic keys are not set. */
  ask?: (req: AskRequest) => Promise<AskResponse>;
};

export function createApp({ nearby: source, ask }: Deps) {
  const app = new Hono();

  app.get("/health", (c) => c.json({ ok: true }));

  // Places around a point, with the pages that mention them. Links back to the original site.
  app.get("/nearby", async (c) => {
    const query = safeDecode(NearbyQuery)(c.req.query());
    if (!query.success) {
      return c.json({ error: "invalid query", issues: query.message }, 400);
    }
    return c.json(Schema.decodeUnknownSync(NearbyResponse)(await nearby(source, query.data)));
  });

  // A grounded answer to a question, with links to the pages it comes from.
  app.post("/ask", async (c) => {
    if (!ask) return c.json({ error: "ask is not configured" }, 503);
    const body = await c.req.json().catch(() => null);
    const req = safeDecode(AskRequest)(body);
    if (!req.success) return c.json({ error: "invalid request", issues: req.message }, 400);
    return c.json(Schema.decodeUnknownSync(AskResponse)(await ask(req.data)));
  });

  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: "internal error" }, 500);
  });

  return app;
}
