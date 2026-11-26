---

name: coords
description: Add coordinates to unlocated places, most-mentioned first, in a local web tool that shows each place with its images and a field to paste coordinates. Claude starts the tool and commits the result. Use when the user asks to add coords or locate places, e.g. "/coords".
---

# Coords

Locate the places that still have no coordinates, most-mentioned first. The user works in a local web page (`apps/coords`) and supplies every coordinate. **Never guess or invent coordinates**, and don't use outside knowledge to fill them in.

## Steps

1. Be on `main` and up to date: `git switch main && git pull --ff-only`. If that fails, say why and stop.
2. Start the tool:
   - Run `pnpm coords` in the background (`run_in_background`).
   - Wait until it answers (`curl --retry 20 --retry-connrefused --retry-delay 1 http://localhost:5175/`), then `open http://localhost:5175/`.
   - If a port is taken, don't kill the other process. Pick free ones with `COORDS_PORT` (page, default 5175) and `COORDS_API_PORT` (default 8790).
3. Tell the user, in a few lines: paste coordinates or a Google Maps URL and press Enter, `Skip` for places they don't know, `Not in Nykarleby` for places outside it, and say `stop` here when done. Then wait.
   - The tool checks that the point is in the Nykarleby area and writes `data/sources/manual-places.json`. `Not in Nykarleby` adds the place to `data/sources/ignored-places.json`.
   - If the user gives coordinates in the chat, or says other names share a point (e.g. "samskolan and normen"), save each one with
     `curl -s -X POST http://localhost:5175/api/save -H 'content-type: application/json' -d '{"name":"<gazetteer name>","input":"<lat>, <lng>"}'`.
     Don't assume on your own that places share a point.
4. When the user says "stop" or "done":
   - Stop the background task.
   - Read `git diff data/sources` for the places that got a location or were ignored. If there are none, say so and finish.
   - Run `gazetteer:build` and `places:geocode` (`pnpm --silent --filter @tuttemuj/crawler ...`), then `pnpm format`.
   - Commit straight to `main` as `data: add coordinates for N places` (add `, ignore M` when places were ignored; with only ignored ones, `data: ignore M places outside Nykarleby`), listing the names in the body, and push. This is a data-only commit, so no branch or PR.
   - Report the new number of located places (`Geocoded ... N of M places located`).
