# Crawling

The site owner is OK with polite crawling. The crawler fetches **one page at a time**, waits **5 s** between requests, sends a User-Agent that identifies the project, and stops after **50 pages per run**.

## Data

| Path                  | In git | What it holds                                                                                |
| --------------------- | ------ | -------------------------------------------------------------------------------------------- |
| `data/frontier.jsonl` | yes    | Every known URL with its crawl status, content hash and Last-Modified header. Sorted by URL. |
| `data/runs.jsonl`     | yes    | One summary line per run.                                                                    |
| `.cache/pages/**`     | **no** | Raw HTML, decoded to UTF-8, so pages can be re-analysed without fetching them again.         |

Page text is never committed (see CLAUDE.md).

## Commands

```sh
pnpm --filter @tuttemuj/crawler seed    # add URLs from the outdated sitemap (safe to re-run)
pnpm --filter @tuttemuj/crawler crawl   # fetch the next batch
```

Pages are crawled in priority order, with place-related sections first (houses, street names, maps, walks). See `apps/crawler/src/url.ts`. Links found on each fetched page are added to the frontier.

Settings come from environment variables: `CRAWL_LIMIT`, `CRAWL_DELAY_MS` (minimum 1000), `CRAWL_TIMEOUT_MS`, `CRAWL_MAX_ATTEMPTS` and `USER_AGENT`.

## Nightly runs (macOS)

Use a **dedicated clone** on `main`, so the job never touches your work in progress:

```sh
git clone https://github.com/erikhayry/tuttemuj.git ~/tuttemuj-crawler
cd ~/tuttemuj-crawler && pnpm install
./scripts/install-launchd.sh
```

Every night at 03:15, `scripts/nightly.sh` does the following:

1. Pulls the latest `main`.
2. Crawls the next batch.
3. Commits `data/` and pushes it, which is the backup.

The log is written to `.cache/nightly.log`.
