---
name: coords
description: Add coordinates to unlocated places one by one, most-mentioned first. Claude shows a place with context and a map link, the user replies with coordinates, Claude saves them. Use when the user asks to add coords or locate places, e.g. "/coords".
---

# Coords

Locate the most-mentioned places that still have no coordinates, one at a time. The user supplies the coordinates (usually picked in Google Maps). **Never guess or invent coordinates**, and don't use outside knowledge to fill them in.

## Steps

1. Get the next place:
   - Run `pnpm --silent --filter @tuttemuj/crawler places:unlocated 30 --json`. It is ranked by the number of analysed pages that mention each place.
   - Skip places the user has already skipped in this session.
2. Show **one** place at a time, briefly:
   - Name, kind, alternate names and the page count.
   - Two or three context lines taken from `data/pages/**` (page titles and any `address` or `description` for that place), so the user can tell which spot is meant. Don't quote page text; use our own summaries.
   - A Google Maps search link: `https://www.google.com/maps/search/?api=1&query=<name>+Nykarleby` (URL-encoded).
   - Ask for coordinates. Accept `63.5241, 22.5285`, a Google Maps URL (`@lat,lng` or `!3d<lat>!4d<lng>`) or "skip".
3. When the user replies:
   - Save it as `"location": {"lat": ..., "lng": ...}` on the matching entry in `data/sources/manual-places.json` (keep the file sorted by name, 2-space JSON). If the place is not a manual entry, add one with the same name and kind.
   - If the user says other names share the point (e.g. "samskolan and normen"), add `location` to those entries too. Don't assume that on your own.
   - Confirm in one line, then show the next place immediately.
   - "skip" leaves it alone. "stop" or "done" goes to step 4.
4. After every ~10 places, or when the user stops:
   - Run `gazetteer:build` and `places:geocode` (`pnpm --silent --filter @tuttemuj/crawler ...`), then `pnpm format`.
   - Commit straight to `main` as `data: add coordinates for N places`, listing the names in the body, and push. This is a data-only commit, so no branch or PR.
   - Report the new number of located places (`Geocoded ... N of M places located`).
