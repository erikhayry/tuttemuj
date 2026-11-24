/**
 * Ask TypeSafe Jev what each large image on the site shows, and save the answers to
 * data/images.jsonl (see docs/images.md).
 *
 * Images are fetched one at a time, CRAWL_DELAY_MS apart, with the crawler's User-Agent, written to
 * a temporary folder only long enough to resize and send them, and deleted right after. Only the
 * answers are kept. Images already answered with the current IMAGE_QUESTIONS_VERSION are skipped,
 * so each night continues where the last one stopped.
 *
 *   IMAGE_CLASSIFY_LIMIT=5 pnpm --filter @tuttemuj/crawler images:classify
 *
 * Needs JEV_API_KEY in .env; without it the command does nothing.
 */
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  EnvSecret,
  envInt,
  IMAGE_QUESTIONS_VERSION,
  ImageClassification,
  isDecorativeImage,
  isShowableImage,
  needsImageReview,
  readEnv,
  type SourceUrl,
} from "@tuttemuj/schema";
import { Schema } from "effect";
import { loadConfig } from "../config.ts";
import { Frontier } from "../frontier.ts";
import { askAboutImage } from "../images/jev.ts";
import { prepareImage } from "../images/prepare.ts";
import { readJsonl, writeJsonl } from "../jsonl.ts";

const config = loadConfig();
const env = readEnv(
  Schema.Struct({
    JEV_API_KEY: Schema.optionalKey(EnvSecret),
    /** Images sent to Jev per run. Each one is also a request to the site, so keep it polite. */
    IMAGE_CLASSIFY_LIMIT: envInt(1000, Schema.isGreaterThan(0)),
  }),
);
if (!env.JEV_API_KEY) {
  console.log("JEV_API_KEY is not set; not classifying images.");
  process.exit(0);
}
const apiKey = env.JEV_API_KEY;

const path = join(config.DATA_DIR, "images.jsonl");
const rows = new Map<string, ImageClassification>(
  (await readJsonl(path, ImageClassification)).map((r) => [r.url, r]),
);
const save = () =>
  writeJsonl(
    path,
    [...rows.values()].sort((a, b) => a.url.localeCompare(b.url)),
  );

// Every large image, once, in the crawl's priority order, that has no answer for this version.
const frontier = await Frontier.load(join(config.DATA_DIR, "frontier.jsonl"));
const todo = [
  ...new Set(frontier.byPriority("fetched").flatMap((e) => (e.images ?? []).map((i) => i.url))),
].filter((url) => rows.get(url)?.questionsVersion !== IMAGE_QUESTIONS_VERSION);

const now = () => new Date().toISOString();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const counts = { classified: 0, decorative: 0, failed: 0, tokens: 0 };
const dir = await mkdtemp(join(tmpdir(), "tuttemuj-images-"));
let fetched = 0;

try {
  for (const url of todo) {
    if (fetched >= env.IMAGE_CLASSIFY_LIMIT) break;
    const skip = (skipped: "decorative" | "fetch-failed" | "unsupported", detail?: string) =>
      rows.set(url, {
        url: url as SourceUrl,
        skipped,
        ...(detail ? { detail } : {}),
        questionsVersion: IMAGE_QUESTIONS_VERSION,
        classifiedAt: now(),
      });

    // Logos and headers are never fetched.
    if (isDecorativeImage({ url })) {
      skip("decorative");
      counts.decorative++;
      continue;
    }

    if (fetched > 0) await sleep(config.CRAWL_DELAY_MS); // one request to the site at a time
    fetched++;
    const src = join(dir, "src");
    const jpg = join(dir, "image.jpg");
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": config.USER_AGENT },
        signal: AbortSignal.timeout(config.CRAWL_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await writeFile(src, Buffer.from(await res.arrayBuffer()));
    } catch (err) {
      skip("fetch-failed", String(err instanceof Error ? err.message : err));
      counts.failed++;
      continue;
    }
    try {
      await prepareImage(src, jpg);
    } catch (err) {
      skip("unsupported", String(err instanceof Error ? err.message : err).slice(0, 200));
      counts.failed++;
      continue;
    } finally {
      await rm(src, { force: true });
    }

    // An API error (no credits, outage, a changed format) stops the run: it is not an answer.
    const a = await askAboutImage(apiKey, jpg);
    await rm(jpg, { force: true });
    rows.set(url, {
      url: url as SourceUrl,
      photo: a.photo,
      buildingVisible: a.buildingVisible,
      peopleVisible: a.peopleVisible,
      peopleSubject: a.peopleSubject,
      model: a.model,
      questionsVersion: IMAGE_QUESTIONS_VERSION,
      classifiedAt: now(),
    });
    counts.classified++;
    counts.tokens += a.tokens;
    if (counts.classified % 50 === 0) await save(); // keep progress if the run is stopped
  }
} finally {
  await save();
  await rm(dir, { recursive: true, force: true }); // the site's images are never kept
}

const all = [...rows.values()];
console.log(
  `Classified ${counts.classified} images (${counts.decorative} decorative skipped, ${counts.failed} failed), ` +
    `${counts.tokens} input tokens. ${todo.length - counts.classified - counts.decorative - counts.failed} left. ` +
    `In total ${all.filter(isShowableImage).length} showable, ${all.filter(needsImageReview).length} to review.`,
);
