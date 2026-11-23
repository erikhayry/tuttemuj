# Crawling

The site owner is OK with polite crawling. The crawler fetches **one page at a time**, waits **5 s** between requests, sends a User-Agent that identifies the project, and stops after **1000 pages per run**.

## Data

| Path                  | In git | What it holds                                                                                |
| --------------------- | ------ | -------------------------------------------------------------------------------------------- |
| `data/frontier.jsonl` | yes    | Every known URL with its crawl status, content hash and Last-Modified header. Sorted by URL. |
| `data/runs.jsonl`     | yes    | One summary line per run.                                                                    |
| `.cache/pages/**`     | **no** | Raw HTML, decoded to UTF-8, so pages can be re-analysed without fetching them again.         |

| `data/pages/**.json` | yes | Structured facts extracted from each page (see below). |
| `.cache/extract/**` | **no** | Plain text of the pages and draft files for the current analysis batch. |

Page text is never committed (see CLAUDE.md).

## Commands

```sh
pnpm --filter @tuttemuj/crawler seed    # add URLs from the outdated sitemap (safe to re-run)
pnpm --filter @tuttemuj/crawler crawl   # fetch the next batch
```

Pages are crawled in priority order, with place-related sections first (houses, street names, maps, walks). See `apps/crawler/src/url.ts`. Links found on each fetched page are added to the frontier.

The site is crawled out, so each run first re-fetches the entry page (`ENTRY_URL`, default `/sidor/nyheter/nyinfort.htm`), where new content is posted. Links on it that are not yet in the frontier are added and crawled in the same run. The old news archive (`/sidor/nyheter/old<YYMM>.html`) is no longer crawled, even where its URLs are already in the frontier. If the entry page cannot be fetched, the run carries on with the pending pages.

Settings come from environment variables: `CRAWL_LIMIT`, `CRAWL_DELAY_MS` (minimum 1000), `CRAWL_TIMEOUT_MS`, `CRAWL_MAX_ATTEMPTS`, `ENTRY_URL` and `USER_AGENT`.

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

To run the same job now, use `/crawl` in Claude Code (`.claude/skills/crawl/SKILL.md`), or run `launchctl kickstart gui/$(id -u)/tuttemuj.crawl`.

### Nightly extract and publish

A second job, `tuttemuj.extract`, runs at 04:00 (the crawl may still be running) and does what you would do by hand:

1. Runs `claude -p "/extract-pages 100"` headless, on your Claude Code subscription (`ANTHROPIC_API_KEY` is unset for it). Set `EXTRACT_COUNT` to change the 100.
2. Commits and pushes `data/` (`data: nightly extract <date>`).
3. Runs `pnpm data:publish`: rebuilds the derived files, syncs to Supabase and embeds the new pages with Voyage.

It needs the clone's `.env` (`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `VOYAGE_API_KEY`) and Claude Code logged in on that machine. It refuses to run if there are changes outside `data/` or if it isn't on `main`. It can overlap with the crawl: it never commits `frontier.jsonl` or `runs.jsonl`, which the crawl owns. The log is `.cache/nightly-extract.log`. Run it now with `launchctl kickstart gui/$(id -u)/tuttemuj.extract`.

Don't run `/extract-pages` by hand in the same clone at the same time. If you extract in another clone, pull first so you don't redo the same pages.

## Analysis (manual, with Claude Code)

The nightly job only fetches pages. You run the analysis yourself in Claude Code, which uses your subscription and needs no API key:

```
/extract-pages 20
```

The skill (`.claude/skills/extract-pages/SKILL.md`) works in three steps:

1. `extract:next` picks fetched pages that haven't been analysed, or whose content or `EXTRACTION_VERSION` has changed. It writes their plain text to `.cache/extract/`.
2. Claude writes one draft JSON per page.
3. `extract:save` validates each draft against the Zod schema, adds the hash, version and timestamp, and writes the result to `data/pages/<path>.json`.

Commit `data/pages/` afterwards. The next nightly run also pushes it.

Analysis needs the local `.cache/`, so run it on the machine that does the crawling (or in its clone).
