import { AskRequest, AskResponse, NearbyQuery, NearbyResponse } from "@tuttemuj/schema";
import { Hono } from "hono";
import { type NearbySource, nearby } from "./nearby.ts";
import { type RateLimitOptions, rateLimit } from "./rate-limit.ts";

/** /ask calls Voyage and Claude, so it gets a per-client limit. */
const ASK_LIMIT: Omit<RateLimitOptions, "now"> = { max: 20, windowMs: 60_000 };

export type Deps = {
  nearby: NearbySource;
  /** Answers a question. Missing when the Voyage or Anthropic keys are not set. */
  ask?: (req: AskRequest) => Promise<AskResponse>;
  askLimit?: Omit<RateLimitOptions, "now">;
};

export function createApp({ nearby: source, ask, askLimit = ASK_LIMIT }: Deps) {
  const app = new Hono();

  app.get("/health", (c) => c.json({ ok: true }));
  app.use("/ask", rateLimit(askLimit));

  // Places around a point, with the pages that mention them. Links back to the original site.
  app.get("/nearby", async (c) => {
    const query = NearbyQuery.safeParse(c.req.query());
    if (!query.success) {
      return c.json({ error: "invalid query", issues: query.error.issues }, 400);
    }
    return c.json(NearbyResponse.parse(await nearby(source, query.data)));
  });

  // A grounded answer to a question, with links to the pages it comes from.
  app.post("/ask", async (c) => {
    if (!ask) return c.json({ error: "ask is not configured" }, 503);
    const body = await c.req.json().catch(() => null);
    const req = AskRequest.safeParse(body);
    if (!req.success) return c.json({ error: "invalid request", issues: req.error.issues }, 400);
    return c.json(AskResponse.parse(await ask(req.data)));
  });

  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: "internal error" }, 500);
  });

  return app;
}
