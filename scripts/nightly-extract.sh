#!/usr/bin/env bash
# Nightly extract: run the data skills with Claude Code, commit and push data/, then publish to
# Supabase (sync) and Voyage (embed). Runs in the same dedicated clone as nightly.sh.
#
# Two passes, each with its own batch size (0 skips a pass):
#   /extract-pages  EXTRACT_COUNT (default 100): new pages, changed pages and pages with an older
#                   extraction version.
#   /enrich-pages   ENRICH_COUNT (default 100): adds the v1 fields to pages already extracted.
#                   Skipped until .claude/skills/enrich-pages/SKILL.md exists (#54).
# Each pass is stopped after CLAUDE_TIME_LIMIT seconds (default 5400). Whatever a pass saved is
# still committed, even if it was stopped or failed.
#
# Uses the Claude Code subscription (no Anthropic API key). The skills never publish; this script does.
set -euo pipefail

cd "$(dirname "$0")/.."
export PNPM_HOME="${PNPM_HOME:-$HOME/Library/pnpm}"
export PATH="$PNPM_HOME/bin:$PNPM_HOME:$HOME/.local/share/pnpm:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
for cmd in pnpm claude perl; do
  command -v "$cmd" >/dev/null || { echo "$cmd not found on PATH ($PATH)" >&2; exit 1; }
done

EXTRACT_COUNT="${EXTRACT_COUNT:-100}"
ENRICH_COUNT="${ENRICH_COUNT:-100}"
CLAUDE_TIME_LIMIT="${CLAUDE_TIME_LIMIT:-5400}"
for n in "$EXTRACT_COUNT" "$ENRICH_COUNT" "$CLAUDE_TIME_LIMIT"; do
  [[ "$n" =~ ^[0-9]+$ ]] || { echo "EXTRACT_COUNT, ENRICH_COUNT and CLAUDE_TIME_LIMIT must be numbers." >&2; exit 1; }
done

[[ "$(git rev-parse --abbrev-ref HEAD)" == "main" ]] || { echo "Refusing to run: not on main." >&2; exit 1; }
if [[ -n "$(git status --porcelain -- . ':!data')" ]]; then
  echo "Working tree has changes outside data/; aborting." >&2
  exit 1
fi
[[ -f .env ]] || { echo ".env is missing (needs SUPABASE_URL, SUPABASE_SECRET_KEY, VOYAGE_API_KEY)." >&2; exit 1; }
# The crawl may still be running: it only touches frontier.jsonl, runs.jsonl and .cache/pages,
# so this job never commits those two files (the crawl commits them itself).

git pull --rebase --autostash --quiet
pnpm install --frozen-lockfile --silent

# Runs one data skill headless. Allowed: reading/writing files and pnpm shell commands.
# Never allowed: publishing, pushing or anything else that touches production.
# Returns non-zero when the skill failed or hit the time limit; the caller carries on.
run_skill() {
  local skill="$1" count="$2"
  echo "== $(date -u +%FT%TZ) /$skill $count pages (limit ${CLAUDE_TIME_LIMIT}s)"
  # perl's alarm stops claude after the time limit (macOS has no timeout command).
  env -u ANTHROPIC_API_KEY perl -e 'alarm shift; exec @ARGV' "$CLAUDE_TIME_LIMIT" claude -p \
    "/$skill $count. This is an unattended run: do not ask questions, and do not run data:publish (the wrapper script does that)." \
    --permission-mode acceptEdits \
    --allowedTools "Read" "Write" "Edit" "Bash(pnpm:*)" \
    --disallowedTools "Bash(pnpm data:publish:*)" "Bash(pnpm * sync*)" "Bash(pnpm * embed*)" "Bash(git push:*)"
}

passes=()
if (( EXTRACT_COUNT > 0 )); then
  if run_skill extract-pages "$EXTRACT_COUNT"; then passes+=("extract"); else
    echo "/extract-pages stopped or failed (exit $?); committing what it saved." >&2
    passes+=("extract (incomplete)")
  fi
fi
if (( ENRICH_COUNT > 0 )); then
  if [[ ! -f .claude/skills/enrich-pages/SKILL.md ]]; then
    echo "== /enrich-pages skipped: the skill doesn't exist yet."
  elif run_skill enrich-pages "$ENRICH_COUNT"; then passes+=("enrich"); else
    echo "/enrich-pages stopped or failed (exit $?); committing what it saved." >&2
    passes+=("enrich (incomplete)")
  fi
fi

# Commit the results first, so a failed publish never loses them.
git add data ":!data/frontier.jsonl" ":!data/runs.jsonl"
if git diff --cached --quiet; then
  echo "No data changes; nothing to publish."
  exit 0
fi
pages="$(git diff --cached --name-only -- data/pages | wc -l | tr -d ' ')"
summary="$(IFS=,; echo "${passes[*]:-none}")"
git commit --quiet -m "data: nightly extract $(date -u +%Y-%m-%d)" \
  -m "$pages page files added or changed. Passes: ${summary//,/, }."
git pull --rebase --autostash --quiet
git push --quiet
echo "Pushed data ($pages page files)."

echo "== publish"
pnpm data:publish

# data:rebuild can change derived files; commit them too.
git add data ":!data/frontier.jsonl" ":!data/runs.jsonl"
if ! git diff --cached --quiet; then
  git commit --quiet -m "data: rebuild derived files $(date -u +%Y-%m-%d)"
  git pull --rebase --autostash --quiet
  git push --quiet
fi
echo "Done."
