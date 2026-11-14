#!/usr/bin/env bash
# Nightly crawl: fetch the next batch of pages, then commit and push data/ as backup.
# Meant to run from a dedicated clone checked out on main (see docs/crawling.md),
# so it never interferes with work in progress.
set -euo pipefail

cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

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

git add data
if git diff --cached --quiet; then
  echo "No data changes."
  exit 0
fi
summary="$(tail -n 1 data/runs.jsonl)"
git commit --quiet -m "data: nightly crawl $(date -u +%Y-%m-%d)" -m "$summary"
git push --quiet
echo "Pushed data."
