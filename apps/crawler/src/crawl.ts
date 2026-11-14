import { setTimeout as sleep } from "node:timers/promises";
import type { CrawlRun, FrontierEntry } from "@tuttemuj/schema";
import type { PageCache } from "./cache.ts";
import type { Config } from "./config.ts";
import { type FetchOptions, fetchPage } from "./fetcher.ts";
import type { Frontier } from "./frontier.ts";
import { parsePage, sha256 } from "./parse.ts";

export type CrawlDeps = {
  config: Config;
  frontier: Frontier;
  cache: PageCache;
  fetch?: FetchOptions["fetch"];
  sleep?: (ms: number) => Promise<unknown>;
  now?: () => Date;
  log?: (msg: string) => void;
};

/** Fetch up to CRAWL_LIMIT pending URLs, one at a time with a pause in between. */
export async function runCrawl(deps: CrawlDeps): Promise<CrawlRun> {
  const { config, frontier, cache } = deps;
  const wait = deps.sleep ?? sleep;
  const now = deps.now ?? (() => new Date());
  const log = deps.log ?? console.log;

  const startedAt = now().toISOString();
  const run = { attempted: 0, fetched: 0, gone: 0, failed: 0, discovered: 0 };
  const batch = frontier.next(config.CRAWL_LIMIT);

  for (const [i, entry] of batch.entries()) {
    if (i > 0) await wait(config.CRAWL_DELAY_MS);
    run.attempted++;

    const result = await fetchPage(entry.url, {
      userAgent: config.USER_AGENT,
      timeoutMs: config.CRAWL_TIMEOUT_MS,
      ...(deps.fetch ? { fetch: deps.fetch } : {}),
    });
    const base: FrontierEntry = {
      ...entry,
      attempts: entry.attempts + 1,
      lastAttemptAt: now().toISOString(),
    };

    if (result.kind === "ok") {
      const page = parsePage(result.html, entry.url);
      await cache.write(entry.url, result.html);
      for (const link of page.links) if (frontier.add(link, entry.url, now())) run.discovered++;
      const { error: _error, ...rest } = base;
      frontier.update({
        ...rest,
        status: "fetched",
        httpStatus: result.status,
        contentHash: sha256(page.text),
        images: page.images,
        ...(result.lastModified ? { lastModified: result.lastModified } : {}),
      });
      run.fetched++;
      log(`✓ ${entry.url} (+${page.links.length} links, ${page.images.length} images)`);
    } else if (result.kind === "gone") {
      frontier.update({ ...base, status: "gone", httpStatus: result.status });
      run.gone++;
      log(`∅ ${entry.url} gone`);
    } else {
      const giveUp = base.attempts >= config.CRAWL_MAX_ATTEMPTS;
      frontier.update({
        ...base,
        status: giveUp ? "failed" : "pending",
        error: result.error,
        ...(result.status ? { httpStatus: result.status } : {}),
      });
      run.failed++;
      log(`✗ ${entry.url} ${result.error}${giveUp ? " (giving up)" : ""}`);
    }
    // Persist after every page so an interrupted run loses nothing.
    await frontier.save();
  }

  return {
    startedAt,
    finishedAt: now().toISOString(),
    ...run,
    pendingAfter: frontier.count("pending"),
  };
}
