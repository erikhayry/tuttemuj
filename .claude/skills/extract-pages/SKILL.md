---

name: extract-pages
description: Analyse crawled nykarlebyvyer.nu pages into structured data (people, places, events, dates, summary) in data/pages. Use when the user asks to analyse, extract or process crawled pages, e.g. "/extract-pages 20".
---

# Extract pages

Turn crawled pages into structured facts that validate against `PageExtractionDraft` (`packages/schema/src/entities.ts`). The argument is the number of pages to do. If no number is given, do 10.

## Steps

1. Run `pnpm --filter @tuttemuj/crawler extract:next <count>`. It prints each page's text file and draft path.
   - The JSON Schema for drafts is in `.cache/extract/draft.schema.json`. Read it once.
2. For each page:
   - Read its text file.
   - Write a draft JSON file to its `draftPath`.
   - To save context, do the pages one by one. Don't read them all first.
3. Run `pnpm --filter @tuttemuj/crawler extract:save`.
   - It validates each draft and moves it to `data/pages/`.
   - If a draft is invalid, fix it and run the save again until nothing is invalid.
4. Report how many pages were saved. Also note anything interesting, such as pages that are only menus or index pages, or cases where the schema doesn't fit the content well.

## Draft fields

- `sourceUrl`: copy it exactly from the batch.
- `title`: the page title, cleaned up.
- `model`: your model id, e.g. `claude-opus-5-5`.
- `summary`: **in Swedish, in your own words, 1–3 sentences.**
  - Never copy sentences from the page. The app sends readers to the original page, so the summary should make them want to click.
- `topics`: a few short lowercase Swedish keywords, e.g. `"handel"`, `"kyrka"`, `"1808–09 års krig"`.
- `people`: every named person who matters to the page.
  - Give `birthYear`/`deathYear` only when the page states them.
  - `roles` covers things like occupation and title ("rådman", "skeppsbyggare").
  - Put spelling variants in `alternateNames`.
- `places`: streets, buildings, farms, districts, landmarks, waters and villages.
  - Pick the closest `kind`.
  - `address`: copy it as written (old addresses are valuable). Add today's address in the `description` only if the page gives it.
  - Places that are tied to a physical spot in Nykarleby are the most important, since the app answers "what happened here?".
- `events`: things that happened, each with a `date` as precise as the page allows.
  - `year` is required.
  - Set `circa: true` for "omkring", "ca" and similar.
  - Put the original wording in `date.text`.
  - `people` and `places` reference names used in the lists above.

## Rules

- Only include facts stated on the page. Don't add outside knowledge or guesses.
- Menus, index pages and pages with almost no text still get a draft: a one-sentence summary saying what the page lists, and empty arrays.
- Poems and fiction: summarise the theme, and only extract real people and places.
- Never put long passages of page text in the output.
