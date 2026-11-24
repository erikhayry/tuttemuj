import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { EXTRACTION_VERSION, PageExtraction } from "@tuttemuj/schema";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { PageCache } from "../cache.ts";
import { Frontier } from "../frontier.ts";
import { prepareBatch, saveDrafts } from "./extract.ts";
import { extractionPaths, pageId } from "./paths.ts";

const URL_A = "https://www.nykarlebyvyer.nu/sidor/texter/hus/a.htm";

function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("expected a value");
  return value;
}

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "extract-"));
  const paths = extractionPaths(join(dir, "data"), join(dir, "cache"));
  const cache = new PageCache(join(dir, "cache"));
  const frontier = await Frontier.load(join(dir, "data", "frontier.jsonl"));
  frontier.add(URL_A);
  frontier.update({
    ...must(frontier.get(URL_A)),
    status: "fetched",
    contentHash: "h1",
    attempts: 1,
  });
  await cache.write(URL_A, "<title>Hus A</title><body>Gården byggdes 1850 av Anders.</body>");
  return { paths, cache, frontier };
}

const writeDraft = async (path: string, value: unknown) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value));
};

describe("extraction batches", () => {
  it("derives page ids from URL paths", () => {
    expect(pageId(URL_A)).toBe("sidor/texter/hus/a");
  });

  it("prepares text + schema, then validates and stamps drafts", async () => {
    const { paths, cache, frontier } = await setup();
    const task = must((await prepareBatch({ frontier, cache, paths, limit: 5 }))[0]);
    expect(await readFile(task.textPath, "utf8")).toContain("Gården byggdes 1850");
    expect(JSON.parse(await readFile(paths.schema, "utf8"))).toHaveProperty("properties.summary");

    await writeDraft(task.draftPath, {
      sourceUrl: URL_A,
      title: "Hus A",
      summary: "Gården uppfördes 1850.",
      model: "claude-opus-5-5",
      comicCandidate: null,
      pageType: "article",
      relations: [],
      images: [],
      events: [{ title: "Gården byggs", date: { year: 1850 }, people: ["Anders"] }],
    });
    const result = await saveDrafts({ paths, now: new Date("2026-11-15T00:00:00Z") });
    expect(result).toMatchObject({ saved: [URL_A], invalid: [] });

    const saved = Schema.decodeUnknownSync(PageExtraction)(
      JSON.parse(await readFile(paths.page(URL_A), "utf8")),
    );
    expect(saved).toMatchObject({ contentHash: "h1", extractionVersion: EXTRACTION_VERSION });

    // Already extracted with the same hash: nothing left to do.
    expect(await prepareBatch({ frontier, cache, paths, limit: 5 })).toHaveLength(0);
    // Content changed: the page comes back.
    frontier.update({ ...must(frontier.get(URL_A)), contentHash: "h2" });
    expect(await prepareBatch({ frontier, cache, paths, limit: 5 })).toHaveLength(1);
  });

  it("reports invalid drafts without saving", async () => {
    const { paths, cache, frontier } = await setup();
    const [first] = await prepareBatch({ frontier, cache, paths, limit: 5 });
    await writeDraft(must(first).draftPath, { sourceUrl: URL_A, title: "x" });
    const result = await saveDrafts({ paths });
    expect(result.saved).toHaveLength(0);
    expect(result.invalid[0]?.error).toMatch(/summary/);
  });
});
