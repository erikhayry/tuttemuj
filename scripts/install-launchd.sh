#!/usr/bin/env bash
# Install (or reinstall) the nightly jobs as launchd agents for the clone this script lives in:
# tuttemuj.crawl (03:15) and tuttemuj.extract (07:00).
set -euo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$repo/.cache" "$HOME/Library/LaunchAgents"
for job in crawl extract; do
  target="$HOME/Library/LaunchAgents/tuttemuj.$job.plist"
  sed "s|__REPO__|$repo|g" "$repo/scripts/launchd/tuttemuj.$job.plist" > "$target"
  launchctl bootout "gui/$(id -u)" "$target" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$target"
  echo "Installed $target (from $repo)."
  echo "  Run now:   launchctl kickstart gui/$(id -u)/tuttemuj.$job"
  echo "  Uninstall: launchctl bootout gui/$(id -u) $target && rm $target"
done
