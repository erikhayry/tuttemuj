import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PageCache } from "./cache.ts";
import { loadConfig } from "./config.ts";
import { runCrawl } from "./crawl.ts";
import { Frontier } from "./frontier.ts";

const BASE = "https://www.nykarlebyvyer.nu/sidor";

const pages: Record<string, string> = {
  [`${BASE}/texter/hus/a.htm`]:
    '<html><head><title>Hus A</title></head><body>Gården byggdes 1850. <a href="b.htm">B</a> <a href="gone.htm">x</a></body></html>',
  [`${BASE}/texter/hus/b.htm`]: "<html><body>Hus B</body></html>",
};

/** Response.url is a read-only getter, so define it on the instance. */
const respond = (body: string, status: number, url: string): Response =>
  Object.defineProperty(new Response(body, { status }), "url", { value: url });

const fakeFetch: typeof fetch = async (input) => {
  const url = String(input);
  const body = pages[url];
  if (body) return respond(body, 200, url);
  // The site redirects missing pages to /notfound.html.
  if (url.includes("gone")) return respond("", 200, "https://www.nykarlebyvyer.nu/notfound.html");
  return respond("", 500, url);
};

async function setup(limit: number) {
  const dir = await mkdtemp(join(tmpdir(), "crawl-"));
  const config = loadConfig({
    CRAWL_LIMIT: String(limit),
    DATA_DIR: dir,
    CACHE_DIR: join(dir, "cache"),
  });
  const frontierPath = join(dir, "frontier.jsonl");
  const frontier = await Frontier.load(frontierPath);
  frontier.add(`${BASE}/texter/hus/a.htm`);
  frontier.add(`${BASE}/texter/poesi/broken.htm`);
  const cache = new PageCache(config.CACHE_DIR);
  const sleeps: number[] = [];
  const deps = {
    config,
    frontier,
    cache,
    fetch: fakeFetch,
    sleep: async (ms: number) => void sleeps.push(ms),
    log: () => {},
  };
  return { deps, frontier, frontierPath, cache, sleeps };
}

describe("runCrawl", () => {
  it("fetches, discovers links, marks gone pages and persists state", async () => {
    const { deps, frontier, frontierPath, cache, sleeps } = await setup(10);

    const first = await runCrawl(deps);
    expect(first).toMatchObject({ fetched: 1, failed: 1, discovered: 2 });
    expect(frontier.get(`${BASE}/texter/hus/a.htm`)?.status).toBe("fetched");
    expect(frontier.get(`${BASE}/texter/poesi/broken.htm`)).toMatchObject({
      status: "pending",
      attempts: 1,
    });
    expect(await cache.read(`${BASE}/texter/hus/a.htm`)).toContain("Gården");
    // Polite: a pause between every pair of requests.
    expect(sleeps).toEqual([5000]);

    const second = await runCrawl(deps);
    expect(second).toMatchObject({ fetched: 1, gone: 1 });

    const reloaded = await Frontier.load(frontierPath);
    expect(reloaded.get(`${BASE}/texter/hus/gone.htm`)?.status).toBe("gone");
    expect(await readFile(frontierPath, "utf8")).not.toContain("Gården");
  });

  it("gives up after max attempts", async () => {
    const { deps, frontier } = await setup(10);
    for (let i = 0; i < 3; i++) await runCrawl(deps);
    expect(frontier.get(`${BASE}/texter/poesi/broken.htm`)).toMatchObject({
      status: "failed",
      attempts: 3,
    });
  });

  it("respects the limit and crawls place pages first", async () => {
    const { deps, frontier } = await setup(1);
    await runCrawl(deps);
    expect(frontier.get(`${BASE}/texter/hus/a.htm`)?.status).toBe("fetched");
    expect(frontier.get(`${BASE}/texter/poesi/broken.htm`)?.attempts).toBe(0);
  });
});
