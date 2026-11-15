---
name: crawl
description: Run the nightly crawl now, exactly as the scheduled launchd job does (pull, crawl the next batch, commit and push data/). Use when the user asks to crawl, run the nightly job or fetch more pages now, e.g. "/crawl".
---

# Crawl now

Starts the installed launchd job `tuttemuj.crawl`, the same job that runs every night at 03:15. It runs `scripts/nightly.sh`, which does this:

1. Checks that the clone is on `main`.
2. Pulls `main`.
3. Crawls up to `CRAWL_LIMIT` (1000) pages, politely.
4. Commits `data/` as `data: nightly crawl <date>` and pushes.

A run takes about 2.5–3 hours (1000 pages × 5 s pause plus fetch time). Don't pass arguments or change the crawl settings: the point is to behave exactly like the nightly run.

## Steps

1. **Preflight** (stop and tell the user if any check fails):
   - Check the branch with `git rev-parse --abbrev-ref HEAD`. It must be `main`.
   - Run `git status --porcelain`:
     - **Changes outside `data/`:** the script will refuse to run. Report them and stop.
     - **Uncommitted changes inside `data/`** (e.g. pages from `/extract-pages`, `manual-places.json`, `gazetteer.json`): the nightly commit would include them under the wrong message. Ask the user whether to commit them first with their own message (recommended), and do that before continuing.
   - Run `launchctl print gui/$(id -u)/tuttemuj.crawl`.
     - **Not found:** the job isn't installed. Offer `./scripts/install-launchd.sh`. Don't run `scripts/nightly.sh` directly without asking.
     - **`state = running`:** a crawl is already in progress. Don't start another; offer to report on it when it finishes.
2. **Note where the log ends**, so you can show only this run's output: `wc -c < .cache/nightly.log` (use 0 if the file is missing).
3. **Start the job:** `launchctl kickstart gui/$(id -u)/tuttemuj.crawl`
4. **Wait without polling in the foreground.** Run this in the background (`run_in_background`). You'll be notified when it exits:
   ```sh
   sleep 5; until launchctl print gui/$(id -u)/tuttemuj.crawl | grep -q 'state = not running'; do sleep 30; done; tail -c +$((OFFSET+1)) .cache/nightly.log | tail -n 40
   ```
   Tell the user the crawl has started and roughly how long it takes. Never report results before the background command has finished.
5. **Report** once it's done:
   - The new line in `data/runs.jsonl`: fetched, failed, gone, new URLs, pending.
   - `last exit code` from `launchctl print`.
   - The commit that was pushed (`git log --oneline -1`).
   - Any `✗` lines or errors in the log output.
   - Roughly how many pages are now waiting for `/extract-pages`: `"status":"fetched"` lines in `data/frontier.jsonl` minus the JSON files under `data/pages/`.
