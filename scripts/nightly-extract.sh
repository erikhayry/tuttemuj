#!/usr/bin/env bash
# Nightly extract: analyse the next pages with Claude Code (/extract-pages), commit and push data/,
# then publish to Supabase (sync) and Voyage (embed). Runs in the same dedicated clone as nightly.sh.
#
# Uses the Claude Code subscription (no Anthropic API key). The skill never publishes; this script does.
set -euo pipefail

cd "$(dirname "$0")/.."
export PNPM_HOME="${PNPM_HOME:-$HOME/Library/pnpm}"
export PATH="$PNPM_HOME/bin:$PNPM_HOME:$HOME/.local/share/pnpm:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
for cmd in pnpm claude; do
  command -v "$cmd" >/dev/null || { echo "$cmd not found on PATH ($PATH)" >&2; exit 1; }
done

COUNT="${EXTRACT_COUNT:-100}"

[[ "$(git rev-parse --abbrev-ref HEAD)" == "main" ]] || { echo "Refusing to run: not on main." >&2; exit 1; }
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean; aborting." >&2
  exit 1
fi
[[ -f .env ]] || { echo ".env is missing (needs SUPABASE_URL, SUPABASE_SECRET_KEY, VOYAGE_API_KEY)." >&2; exit 1; }
# The crawl job uses the same clone. Never overlap with it.
if launchctl print "gui/$(id -u)/tuttemuj.crawl" 2>/dev/null | grep -q 'state = running'; then
  echo "The nightly crawl is still running; try again later." >&2
  exit 1
fi

echo "== $(date -u +%FT%TZ) extract $COUNT pages"
git pull --rebase --quiet
pnpm install --frozen-lockfile --silent

# Headless Claude Code. Allowed: reading/writing files and pnpm/git-free shell commands.
# Never allowed: publishing, pushing or anything else that touches production.
env -u ANTHROPIC_API_KEY claude -p \
  "/extract-pages $COUNT. This is an unattended run: do not ask questions, and do not run data:publish (the wrapper script does that)." \
  --permission-mode acceptEdits \
  --allowedTools "Read" "Write" "Edit" "Bash(pnpm:*)" \
  --disallowedTools "Bash(pnpm data:publish:*)" "Bash(pnpm * sync:*)" "Bash(pnpm * embed:*)" "Bash(git push:*)"

# Commit the extract results first, so a failed publish never loses them.
git add data
if git diff --cached --quiet; then
  echo "No data changes; nothing to publish."
  exit 0
fi
pages="$(git diff --cached --name-only -- data/pages | wc -l | tr -d ' ')"
git commit --quiet -m "data: nightly extract $(date -u +%Y-%m-%d)" -m "$pages page files added or changed"
git pull --rebase --quiet
git push --quiet
echo "Pushed data ($pages page files)."

echo "== publish"
pnpm data:publish

# data:rebuild can change derived files; commit them too.
git add data
if ! git diff --cached --quiet; then
  git commit --quiet -m "data: rebuild derived files $(date -u +%Y-%m-%d)"
  git pull --rebase --quiet
  git push --quiet
fi
echo "Done."
