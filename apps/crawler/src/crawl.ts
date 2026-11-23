import { setTimeout as sleep } from "node:timers/promises";
import type { CrawlRun, FrontierEntry, SourceUrl } from "@tuttemuj/schema";
import type { PageCache } from "./cache.ts";
import type { Config } from "./config.ts";
import { type FetchOptions, fetchPage } from "./fetcher.ts";
import type { Frontier } from "./frontier.ts";
import { parsePage, sha256 } from "./parse.ts";
import { normalizeUrl } from "./url.ts";

export type CrawlDeps = {
  config: Config;
  frontier: Frontier;
  cache: PageCache;
  fetch?: FetchOptions["fetch"];
  sleep?: (ms: number) => Promise<unknown>;
  now?: () => Date;
  log?: (msg: string) => void;
};

/** Fetch up to CRAWL_LIMIT pending URLs, one at a time with a pause in between.
 *  The entry page (ENTRY_URL, where new content is posted) is re-fetched first, every run. */
export async function runCrawl(deps: CrawlDeps): Promise<CrawlRun> {
  const { config, frontier, cache } = deps;
  const wait = deps.sleep ?? sleep;
  const now = deps.now ?? (() => new Date());
  const log = deps.log ?? console.log;

  const startedAt = now().toISOString();
  const run = { attempted: 0, fetched: 0, gone: 0, failed: 0, discovered: 0 };

  // Re-fetch the entry page so links to newly posted pages join the frontier before the batch is picked.
  const entryUrl = normalizeUrl(config.ENTRY_URL);
  let requested = false;
  if (entryUrl) {
    requested = true;
    run.discovered += await refreshEntry(deps, entryUrl, now, log);
    await frontier.save();
  }

  const batch = frontier.next(config.CRAWL_LIMIT);

  for (const [i, entry] of batch.entries()) {
    if (i > 0 || requested) await wait(config.CRAWL_DELAY_MS);
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

/** Fetch the entry page and add links to pages we do not know yet. Returns how many were added. */
async function refreshEntry(
  deps: CrawlDeps,
  url: SourceUrl,
  now: () => Date,
  log: (msg: string) => void,
): Promise<number> {
  const { config, frontier, cache } = deps;
  const result = await fetchPage(url, {
    userAgent: config.USER_AGENT,
    timeoutMs: config.CRAWL_TIMEOUT_MS,
    ...(deps.fetch ? { fetch: deps.fetch } : {}),
  });
  if (result.kind !== "ok") {
    // Not fatal: the batch of pending pages is still crawled.
    log(`✗ entry page ${url} ${result.kind === "gone" ? "gone" : result.error}`);
    return 0;
  }

  const page = parsePage(result.html, url);
  await cache.write(url, result.html);
  frontier.add(url, undefined, now());
  let added = 0;
  for (const link of page.links) if (frontier.add(link, url, now())) added++;

  const known = frontier.get(url);
  if (known) {
    const { error: _error, ...rest } = known;
    frontier.update({
      ...rest,
      status: "fetched",
      attempts: known.attempts + 1,
      lastAttemptAt: now().toISOString(),
      httpStatus: result.status,
      contentHash: sha256(page.text),
      images: page.images,
      ...(result.lastModified ? { lastModified: result.lastModified } : {}),
    });
  }
  log(`⟳ entry page ${url} (${added} new of ${page.links.length} links)`);
  return added;
}
