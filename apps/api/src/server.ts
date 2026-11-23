/** Local API server: `pnpm --filter @tuttemuj/api dev` (reads the root .env). */

import Anthropic from "@anthropic-ai/sdk";
import { serve } from "@hono/node-server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createApp } from "./app.ts";
import { ask } from "./ask.ts";
import { claudeAnswer, DEFAULT_ASK_MODEL } from "./claude.ts";
import { supabaseSource } from "./db.ts";
import { supabaseRetrieve } from "./retrieve.ts";

const env = z
  .object({
    SUPABASE_URL: z.url(),
    SUPABASE_SECRET_KEY: z.string().min(20),
    PORT: z.coerce.number().int().default(8787),
    /** POST /ask needs VOYAGE_API_KEY (search). ANTHROPIC_API_KEY adds written answers. */
    VOYAGE_API_KEY: z.string().min(20).optional(),
    ANTHROPIC_API_KEY: z.string().min(20).optional(),
    ASK_MODEL: z.string().default(DEFAULT_ASK_MODEL),
  })
  .parse(process.env);

const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

// Search needs Voyage. A written answer also needs Anthropic; without it /ask lists matching pages.
const answerer = env.VOYAGE_API_KEY
  ? (() => {
      const retrieve = supabaseRetrieve(db, env.VOYAGE_API_KEY);
      const answer = env.ANTHROPIC_API_KEY
        ? claudeAnswer(new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }), env.ASK_MODEL)
        : undefined;
      return (req: Parameters<typeof ask>[2]) => ask(retrieve, answer, req);
    })()
  : undefined;

const app = createApp({
  nearby: supabaseSource(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY),
  ...(answerer ? { ask: answerer } : {}),
});
serve({ fetch: app.fetch, port: env.PORT }, ({ port }) =>
  console.log(
    `API on http://localhost:${port} (ask: ${answerer ? (env.ANTHROPIC_API_KEY ? "answers" : "search only") : "off"})`,
  ),
);
