/** Local API server: `pnpm --filter @tuttemuj/api dev` (reads SUPABASE_* from the root .env). */
import { serve } from "@hono/node-server";
import { z } from "zod";
import { createApp } from "./app.ts";
import { supabaseSource } from "./db.ts";

const env = z
  .object({
    SUPABASE_URL: z.url(),
    SUPABASE_SECRET_KEY: z.string().min(20),
    PORT: z.coerce.number().int().default(8787),
  })
  .parse(process.env);

const app = createApp(supabaseSource(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY));
serve({ fetch: app.fetch, port: env.PORT }, ({ port }) =>
  console.log(`API on http://localhost:${port}`),
);
