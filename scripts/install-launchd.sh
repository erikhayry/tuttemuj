#!/usr/bin/env bash
# Install (or reinstall) the nightly crawl as a launchd agent for the clone this script lives in.
set -euo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd)"
target="$HOME/Library/LaunchAgents/tuttemuj.crawl.plist"
mkdir -p "$repo/.cache" "$(dirname "$target")"
sed "s|__REPO__|$repo|g" "$repo/scripts/launchd/tuttemuj.crawl.plist" > "$target"
launchctl bootout "gui/$(id -u)" "$target" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$target"
echo "Installed $target (runs nightly at 03:15 from $repo)."
echo "Run now:   launchctl kickstart gui/$(id -u)/tuttemuj.crawl"
echo "Uninstall: launchctl bootout gui/$(id -u) $target && rm $target"
