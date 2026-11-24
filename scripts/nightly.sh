#!/usr/bin/env bash
# Nightly crawl: fetch the next batch of pages, classify the next batch of images, then commit and
# push data/ as backup.
# Meant to run from a dedicated clone checked out on main (see docs/crawling.md),
# so it never interferes with work in progress.
set -euo pipefail

cd "$(dirname "$0")/.."
# launchd starts jobs with a minimal PATH; add the usual Node/pnpm install locations.
export PNPM_HOME="${PNPM_HOME:-$HOME/Library/pnpm}"
export PATH="$PNPM_HOME/bin:$PNPM_HOME:$HOME/.local/share/pnpm:/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v pnpm >/dev/null; then
  echo "pnpm not found on PATH ($PATH)" >&2
  exit 1
fi

branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$branch" != "main" ]]; then
  echo "Refusing to run on branch '$branch' (expected main)." >&2
  exit 1
fi
if [[ -n "$(git status --porcelain -- . ':!data')" ]]; then
  echo "Working tree has changes outside data/; aborting." >&2
  exit 1
fi

git pull --rebase --autostash --quiet
pnpm install --frozen-lockfile --silent
pnpm --filter @tuttemuj/crawler crawl
# After the crawl, never at the same time, so the site gets one request at a time. Needs JEV_API_KEY
# in .env (otherwise it does nothing). A failure here must not lose the crawl's data.
images="$(pnpm --silent --filter @tuttemuj/crawler images:classify 2>&1 | { grep -v CGColor || true; } | tail -n 1)" ||
  images="Image classification failed: $images"
echo "$images"

git add data
if git diff --cached --quiet; then
  echo "No data changes."
  exit 0
fi
summary="$(tail -n 1 data/runs.jsonl)"
git commit --quiet -m "data: nightly crawl $(date -u +%Y-%m-%d)" -m "$summary" -m "$images"
git push --quiet
echo "Pushed data."
