/**
 * Review page for the eval set: see what the search returns for each question and mark each
 * page as a good or bad answer. Marks are saved straight into data/eval/questions.json.
 *
 *   pnpm --filter @tuttemuj/api run review     # then open http://localhost:8788
 *
 * Local only (127.0.0.1). Needs SUPABASE_URL, SUPABASE_SECRET_KEY and VOYAGE_API_KEY. Shows our
 * own summaries and links to the original pages, never page text.
 */
import { readFileSync } from "node:fs";
import { serve } from "@hono/node-server";
import { Lang, safeDecode } from "@tuttemuj/schema";
import { Schema } from "effect";
import { Hono } from "hono";
import { addCase, judge, type Verdict, verdictOf } from "../review.ts";
import { cachedRetrieval, loadCases, saveCases } from "./support.ts";

const PORT = 8788;
const { db, retrieve } = cachedRetrieval();
const page = readFileSync(new URL("./review.html", import.meta.url), "utf8");

const Judge = Schema.Struct({
  id: Schema.String,
  url: Schema.String,
  verdict: Schema.Literals(["good", "bad", "clear"]),
});
const NewCase = Schema.Struct({
  question: Schema.Trim.check(Schema.isMinLength(3), Schema.isMaxLength(300)),
  lang: Lang,
  lat: Schema.optionalKey(Schema.Number.check(Schema.isBetween({ minimum: -90, maximum: 90 }))),
  lng: Schema.optionalKey(Schema.Number.check(Schema.isBetween({ minimum: -180, maximum: 180 }))),
});

const app = new Hono();

// A page on another site must not be able to write to the eval file through the browser.
app.use("/api/*", async (c, next) => {
  const origin = c.req.header("origin");
  if (origin && origin !== `http://localhost:${PORT}` && origin !== `http://127.0.0.1:${PORT}`) {
    return c.json({ error: "forbidden" }, 403);
  }
  await next();
});

app.get("/", (c) => c.html(page));

app.get("/api/cases", (c) =>
  c.json(
    loadCases().map((k) => ({
      id: k.id,
      question: k.question,
      lang: k.lang,
      located: k.lat !== undefined,
      good: k.relevant.length,
      bad: k.irrelevant.length,
    })),
  ),
);

// What the search returns for one question, with the marks so far.
app.get("/api/cases/:id", async (c) => {
  const k = loadCases().find((x) => x.id === c.req.param("id"));
  if (!k) return c.json({ error: "not found" }, 404);
  const { facts } = await retrieve({
    question: k.question,
    lang: k.lang,
    ...(k.lat !== undefined && k.lng !== undefined ? { lat: k.lat, lng: k.lng } : {}),
  });
  const returned = new Set(facts.map((f) => f.sourceUrl));
  // Pages marked good that the search did not return: the misses.
  const missingUrls = k.relevant.filter((u) => !returned.has(u));
  const { data } = missingUrls.length
    ? await db.from("pages").select("source_url,title").in("source_url", missingUrls)
    : { data: [] };
  return c.json({
    id: k.id,
    question: k.question,
    lang: k.lang,
    lat: k.lat,
    lng: k.lng,
    results: facts.map((f, i) => ({
      n: i + 1,
      url: f.sourceUrl,
      title: f.pageTitle,
      summary: f.summary,
      people: f.people,
      verdict: verdictOf(k, f.sourceUrl) ?? null,
    })),
    missing: (data ?? []).map((p) => ({ url: p.source_url as string, title: p.title as string })),
  });
});

app.post("/api/judge", async (c) => {
  const body = safeDecode(Judge)(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "invalid request" }, 400);
  const { id, url, verdict } = body.data;
  saveCases(judge(loadCases(), id, url, verdict as Verdict));
  return c.json({ ok: true });
});

app.post("/api/cases", async (c) => {
  const body = safeDecode(NewCase)(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "invalid request" }, 400);
  const before = loadCases();
  const after = addCase(before, body.data);
  saveCases(after);
  return c.json({ id: after[after.length - 1]?.id });
});

serve({ fetch: app.fetch, port: PORT, hostname: "127.0.0.1" }, () => {
  console.log(
    `Review page: http://localhost:${PORT}  (marks are saved to data/eval/questions.json)`,
  );
});
