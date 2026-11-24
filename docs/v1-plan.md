# v1 plan: location buttons, no AI

Decided on 2026-11-24. This replaces free-text questions as the first release.

## What v1 is

A mobile web app (PWA). The user allows location, and the app offers ready-made buttons for the places around them. Every answer is built from our own data with plain database queries: no Claude and no Voyage at request time, so running the app costs nothing per question. Every result links to the page on nykarlebyvyer.nu.

- **Swedish only.** The UI is built for several languages from the start (see [Multi-language](#multi-language)), but only `sv` is shipped.
- **No free text.** Free text and AI answers are v2.

## Releases

| Release | Scope                                                               |
| ------- | ------------------------------------------------------------------- |
| v1      | Location, 10 buttons, Swedish, mobile web/PWA                       |
| v1.1    | Finnish and English UI, and translated summaries                    |
| v2      | Free-text questions with AI answers (the current `/ask` work in #3) |

## The 10 buttons

Each button is a fixed query for the places near the user (the nearest located places within a radius). Labels are UI strings with stable ids, so they can be translated later.

| #   | Id                     | Label (sv)                   | Answer                                                                                      | Data                                                                  |
| --- | ---------------------- | ---------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1   | `who-lived-here`       | Vem bodde här?               | People who lived at or owned the place, with years                                          | **New:** person–place relations                                       |
| 2   | `what-happened-here`   | Vad hände här?               | Events at the place, oldest first                                                           | Existing: events and event places                                     |
| 3   | `stories-from-here`    | Berätta en historia härifrån | Stories, memories and anecdotes about the place                                             | Existing: story pitches and summaries. **New:** page type             |
| 4   | `old-images-from-here` | Visa gamla bilder härifrån   | Photos and postcards of the place, with year                                                | Existing: page images. **New:** which place and year each image shows |
| 5   | `old-maps`             | Visa på gamla kartor         | Historic map pages that show the place                                                      | Existing: map pages (`sidor/karta/`) and their places                 |
| 6   | `what-was-here`        | Vad fanns här förr?          | What the place used to be (school, pharmacy, shop…), with years, incl. demolished buildings | **New:** place uses                                                   |
| 7   | `who-worked-here`      | Vem arbetade här?            | Businesses, workshops and the people who ran or worked in them                              | **New:** person–place relations and place uses                        |
| 8   | `why-the-name`         | Varför heter det så?         | Where the street or place name comes from                                                   | **New:** name origin                                                  |
| 9   | `on-this-day`          | Hände på dagens datum        | Events near the user on today's day and month, any year                                     | Existing: event dates with month and day                              |
| 10  | `nearby`               | Vad finns i närheten?        | Other places close by that have stories, for walking on                                     | Existing: `nearby_places`                                             |

A button is only shown when it has at least one result for the places around the user.

## Extraction

v1 needs five new kinds of facts. All are derived facts and our own short text, never page text:

- **Person–place relations**: who lived at, owned, built, ran or worked at a place, and the years if the page states them.
- **Place uses**: what a place was used for (skola, apotek, bageri…), with years if stated.
- **Name origin**: a short sentence in our own words about where a name comes from, only when the page explains it.
- **Images**: for each large image on the page, which places it shows and the year, if the page says so.
- **Page type**: photo, postcard, map, memory/story, article, list or menu.

### Add-on pass instead of full re-extraction

The ~3,700 pages already extracted keep their v1 data. A separate, smaller skill (`/enrich-pages`) reads each page again and only adds the new fields. New pages get the full v2 extraction, which covers everything. This costs less of the Claude subscription than redoing every page.

### Images need markers in the text

The text that the extractor reads today has no image positions, so it can't tell which caption belongs to which image. The parser will write an extraction text file with numbered markers (`[bild 1]`, with the alt text) where each image is. The text used for `contentHash` stays as it is, so adding the markers doesn't make every page look changed.

### No recrawl

All 8,710 fetched pages are in the local HTML cache (`.cache/pages`), so the parser changes run offline, like `images:backfill`. The crawl is close to finished (2 pages pending). A later issue adds a polite refresh: a conditional request (`If-Modified-Since`) per page, a few seconds apart, to pick up pages that changed on the site.

### Versioned skills

Today `EXTRACTION_VERSION` is one number and the skill file isn't tied to it. From now on:

- Each data skill (`extract-pages`, `enrich-pages`) has a `version` in its frontmatter.
- `extract:save` stamps the skill name and version into each page file (`extractionVersion` for the full extraction and an `enrichments` list for add-on passes).
- A test fails if a skill's frontmatter version doesn't match the version constant in `packages/schema`.
- `docs/extraction-versions.md` records what changed in each version.
- `extract:next` and `enrich:next` pick pages whose version is older, so old data can be redone a version at a time.

## Stack

- **Effect** for the server and shared logic. **Effect Schema** replaces Zod everywhere, including `packages/schema`, the crawler and the loader. CLAUDE.md is updated to match.
- **Foldkit** for the UI later. It is built on Effect and uses Effect Schema. It is pre-1.0 (v0.171) and web only (SPA, static or server rendering), which is fine for a mobile web app. Native apps (#5) are decided later.
- **Supabase Postgres** with PostGIS stays the database. The loader keeps syncing from git `data/`.
- **No AI and no Voyage at request time** in v1. The nightly embed can keep running so v2 has embeddings ready.

## Testing

No unit tests: feature tests with Playwright and property tests with Bombadil (UI) and generated requests (API). See `docs/testing.md`.

## Server API (v1)

- `GET /places/near?lat&lng&radius`: the located places near the user, nearest first.
- `GET /buttons?lat&lng`: which of the 10 buttons have results here, with a count each.
- `GET /buttons/:id?lat&lng`: the results of one button. Each result has our own title and summary, the year when known, image references and `sourceUrl`.

Responses carry ids and data, never UI text, so the client can show them in any language.

Built with Effect's `HttpApi` (#58) in `apps/api/src/v1/`: `api.ts` defines the endpoints (one definition gives validation, `/openapi.json`, a typed client and `/docs`), `buttons.ts` maps each database function's rows to results, `handlers.ts` implements them, `server.ts` serves them. Run it with `pnpm --filter @tuttemuj/api dev:v1` (port 8787, or `PORT`). It reads from Supabase with the service key and makes no Claude or Voyage calls.

- Query: `lat`, `lng` (inside the Nykarleby bounds), `radius` (10–2000 m, default 200), `limit` (1–100, default 50). `on-this-day` also accepts `month` and `day`; without them it uses today's date in Finland. A bad value gives a 400.
- Each result has `button`, the place (`placeId`, `placeName`, `distanceM`) and the page it comes from (`sourceUrl`, `pageTitle`), so the app can always link to nykarlebyvyer.nu. `nearby` results have no single source page; they carry the place and its `pageCount`.
- `GET /places/near` returns the same `nearby` results: located places that have pages.
- The older Hono server (`pnpm dev`, `/nearby` and `/ask`) is for v2 and stays until #3 moves over.

## Database functions (#57)

`supabase/migrations/20261124230000_button_queries.sql`. One function per button, `button_<id with underscores>(lat, lng, radius_m, limit)`; `button_on_this_day` and `button_counts` also take the month and day (the caller sends today's date in Finnish time). Each row has the place (`place_id`, `place_name`, `distance_m`) and the `source_url` of the page it comes from. Pages that duplicate another page are left out.

`button_counts(lat, lng, radius_m, month, day)` returns one row per button that has results here, with the count (up to the limit). The API shows only those buttons.

"Visa gamla bilder härifrån" returns image URLs from `page_images`, which the loader fills from the crawl's image list and Jev's answers (`data/images.jsonl`). Only images Jev marked as photos with a building or people (`showable`) are returned. The image stays on nykarlebyvyer.nu.

## The app (#60)

`apps/web` is a Foldkit single-page app: `model.ts`, `message.ts`, `update.ts`, `command.ts` (side effects) and `view/`, gathered by a thin `main.ts` styled with native CSS: variables and `@layer` in `src/styles.css`, no Tailwind. Run `pnpm --filter @tuttemuj/api dev:v1` and `pnpm --filter @tuttemuj/web dev`; Vite forwards `/api` to the Effect server, so there is no CORS to set up. `pnpm --filter @tuttemuj/web build` makes the static site in `apps/web/dist`.

- Flow: "Använd min plats" (the browser asks for permission), then the buttons that have results within 200 m, then the results of one button. Denied or unavailable location shows a message and "Försök igen". A position outside Nykarleby, or with no results, shows "nothing here yet".
- All text comes from `@tuttemuj/messages`; the API's answers are checked with the shared schemas. Each result links to its page on nykarlebyvyer.nu; old images load from the site and link to their page.
- Installable: `manifest.webmanifest`, icons and a service worker (`public/sw.js`, production only) that keeps the app shell for offline start. It never caches `/api` or the site's images.
- Not decided yet: where it is hosted and the production `/api` address.

## Multi-language

- UI strings live in a messages catalog keyed by id (`buttons.who-lived-here.label`), one file per language. v1 ships `sv` only; `fi` and `en` exist as empty catalogs with the same keys, checked by the TypeScript build (`Record<MessageKey, string>`), so no unit test is needed. An empty message falls back to Swedish. The catalogs are in `packages/messages`: `message(lang, key, params)` fills `{name}` markers, and `resolveLang` is the one place that picks the language (saved choice, then browser, then Swedish; only `AVAILABLE_LANGS` are offered).
- `Lang` in the schema stays `sv | fi | en`, and the app reads the language from one place (browser setting, then a chooser). In v1 the chooser only offers Swedish.
- Our summaries are Swedish. v1.1 needs Finnish and English summaries too; how to make them (by hand, or as a Claude Code pass on the subscription) is decided then.

## Coordinates are now the main limit

v1 only works where places have coordinates. Today 397 of 2,174 gazetteer names do. Adding coordinates for the most-mentioned places (#40) is the most important data work for v1.

## Images

The site owner has agreed that the app may show the site's images. Images are still never downloaded or rehosted: the app loads them from nykarlebyvyer.nu and each image links to its page.
