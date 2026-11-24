# Testing strategy

Decided on 2026-11-24. **No unit tests.** We test features from the outside, the way a user or a client meets them, plus properties that must always hold. Coverage means every feature has a test, not every line of code.

## The two kinds of test

| Kind | UI | API |
| --- | --- | --- |
| **Feature tests (e2e)** | [Playwright](https://playwright.dev): one test per user-visible feature | Playwright Test (`request` fixture): one test per endpoint feature |
| **Property tests** | [Bombadil](https://github.com/antithesishq/bombadil): random exploration of the running app, checking properties written in TypeScript | Generated requests (Effect Schema's arbitrary generators with fast-check), checking properties of every response |

Playwright Test is the runner for UI feature tests and for all API tests, so there is one runner and one report. Bombadil runs on its own against the app's URL.

## What a feature test is

A feature test covers one thing a user (or a client of the API) can do, end to end, with real code and a real database. It checks the outcome the user sees, not how the code gets there. Edge cases go in a feature test only when the user would notice them (location denied, no places nearby).

**Don't** write a test per function, mock internal modules, or test a branch just to raise coverage.

### UI features (v1)

One Playwright test each. Playwright sets the browser's position (`geolocation` plus the permission) to a fixed spot.

- Allowing location at Torget shows only the buttons that have results there.
- Each of the 10 buttons (`who-lived-here` … `nearby`) shows results, and each result links to its page on nykarlebyvyer.nu.
- `old-images-from-here` shows images loaded from nykarlebyvyer.nu, each linking to its page.
- Denying location shows an explanation and a way to try again.
- A spot with no located places shows the "nothing here yet" message and no buttons.
- The app installs as a PWA (manifest and service worker present).
- All visible text comes from the `sv` catalog.

### API features (v1)

One Playwright Test each, against the Effect server running on a seeded test database.

- `GET /places/near` returns located places nearest first.
- `GET /buttons` returns the buttons with results here, with counts.
- `GET /buttons/:id` returns results for each of the 10 buttons.
- Invalid input (bad coordinates, unknown button) returns 400 with the issues.

## Properties

### UI (Bombadil)

Bombadil clicks and reloads at random and checks these after every step. We export its default properties (no uncaught exceptions, no unhandled promise rejections, no error logs, no 4xx or 5xx responses) plus our own:

- Every result has a link to `https://www.nykarlebyvyer.nu/…`.
- Images are only loaded from nykarlebyvyer.nu.
- No button is shown that leads to an empty result.
- No raw message key (such as `buttons.who-lived-here.label`) is ever visible: all text resolved from the catalog.
- The app never calls anything but our API and nykarlebyvyer.nu (no AI, no Voyage).

Run headless with `--chrome-grant-permissions geolocation --exit-on-violation --output-path`. A failure writes a trace with screenshots that `--reproduce` replays. Bombadil's docs show how to grant the geolocation permission but not how to set a position, so test builds may need a fixed position from the URL (`?lat=…&lng=…`). That is checked when the UI exists (#60).

### API

For generated input (positions inside and outside Nykarleby, every button id, random radii, malformed values):

- Every response validates against its Effect Schema.
- Every result has a `sourceUrl` on nykarlebyvyer.nu.
- The count from `GET /buttons` equals the number of results from `GET /buttons/:id`.
- Results are within the requested radius.
- No text field is longer than our own summaries can be, so page text never leaks.
- Bad input returns 400, never 500.

## Data pipeline

The crawler, extraction and loader are tested the same way: run the command on a small fixture and check what it writes. For example, `extract:save` rejects an invalid draft and stamps the skill version, `places:geocode` locates a known address, and the loader syncs a fixture into the test database. No tests of single functions.

## Test data

Tests never touch production. They run against a local Supabase (`supabase start`, needs Docker) seeded from a small fixture of real derived data: the places, pages and events around Torget, Storbron, Brostugan and Andrasjön. The same fixture serves feature and property tests, so results are stable.

## Existing unit tests

The repo has about 20 Vitest unit test files today. They stay until the code they cover is rewritten in Effect (#49, #50, #58). Each rewrite replaces them with feature tests for that area, and Vitest is removed when the last one goes.

## CI

`.github/workflows/ci.yml` runs lint, typecheck, the API and UI feature tests and the API property tests on every PR. Bombadil runs on every PR with a short time limit (`--time-limit=1m`) and for longer on a nightly schedule.
