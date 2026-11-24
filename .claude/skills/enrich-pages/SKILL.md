---

name: enrich-pages
version: 1
description: Add the v1 fields (page type, person–place relations, place uses, name origin, image facts) to pages that are already analysed, without redoing them. Use when the user asks to enrich pages, e.g. "/enrich-pages 20".
---

# Enrich pages

Add the v1 fields to pages that `/extract-pages` already analysed, so the app can answer "Vem bodde här?", "Vad fanns här förr?" and "Visa gamla bilder härifrån". This is smaller than a full extraction: you only write the new fields. The argument is the number of pages to do. If no number is given, do 10.

The draft schema is `PageEnrichmentDraft` in `packages/schema/src/enrichment.ts`. The old fields (summary, people, places, events) are never changed.

**Versioning.** `version` above must equal `ENRICH_VERSION` in `packages/schema/src/entities.ts` (a test checks this). When you change these instructions or the draft so that enriched pages should be redone, bump both and describe the change in `docs/extraction-versions.md`. `enrich:next` then picks every page with an older stamp. New pages get the full extraction from `/extract-pages` instead, which already includes these fields once that skill says so.

## Steps

1. Run `pnpm --filter @tuttemuj/crawler enrich:next <count>`. It prints each page's text file and draft path.
   - The JSON Schema for drafts is in `.cache/enrich/draft.schema.json`. Read it once.
2. For each page:
   - Read its text file. It starts with the people and places already on the page (use exactly these names), then the page text with `[bild n]` markers where the large images are.
   - Write a draft JSON file to its `draftPath`.
   - To save context, do the pages one by one. Don't read them all first.
3. Run `pnpm --filter @tuttemuj/crawler enrich:save`.
   - It checks each draft, adds the fields to `data/pages/<path>.json` and stamps the page with `enrichments`.
   - If a draft is invalid (for example a name that is not on the page), fix it and run the save again until nothing is invalid.
4. Run `pnpm data:rebuild` (offline) so the derived files in `data/` stay in step.
5. Report how many pages were saved, and anything the schema doesn't fit well.
6. Remind the user to run `pnpm data:publish` when they want the new data in Supabase. Do not run it yourself: it writes to the production database.

## Draft fields

- `sourceUrl`: copy it exactly from the batch.
- `model`: your model id, e.g. `claude-opus-5-5`.
- `pageType`: always set it. Pick the one that fits best:
  - `photo`: the page is mainly one or more photographs with captions.
  - `postcard`: a postcard (vykort).
  - `map`: a map, plan or chart.
  - `story`: a memory, a tale or a personal account.
  - `article`: a factual text about a topic, person, building or event.
  - `list`: a register, table or list of names, houses or items.
  - `menu`: a page that only links to other pages.
  - `empty`: no content of its own (a frame, a lone logo, an empty page).
- `relations`: how a person on the page is tied to a place on the page. `[]` when the page states none.
  - `person` and `place` must be exactly a name from the lists at the top of the text file. If the page names someone or somewhere that is not in the lists, leave it out. Never add new people or places here.
  - `relation` is one of: `lived` (bodde), `owned` (ägde), `built` (byggde eller lät bygga), `ran` (drev, e.g. a shop, inn or business), `worked` (arbetade där), `born` (föddes där), `died` (dog där).
  - `startYear` and `endYear` only when the page states them. "Bodde där till 1920" has only `endYear: 1920`. A single year is the same value in both.
  - One entry per person, place and relation. The same person can have several relations to one place.
- `places`: only places that have something to add, `[]` otherwise. `name` must be exactly a name from the list.
  - `uses`: what the place was used for, each as `use` (one short lowercase Swedish noun, such as "apotek", "skola", "bageri") with `startYear` and `endYear` when stated. Only for uses the page states.
  - `nameOrigin`: where the place's name comes from, in **your own words, one Swedish sentence**. Only when the page explains it.
- `images`: only images the page says something about, `[]` otherwise.
  - `image` is the number in `[bild n]`.
  - `places`: names from the list of the places the image shows, when the page says so. A caption that names a street or a building counts. `[]` if it names none.
  - `year`: the year the image was made or shows, only when stated. "195X" or "1950-talet" is not a year: leave it out.
  - Leave out images with no stated place and no year.

## Rules

- Only include facts the page states. Don't add outside knowledge or guesses.
- Never make things up. If a year, relation, use or origin is not stated on the page, leave it out. Don't fill gaps from memory, and don't infer a year from another one. If unsure whether something is on the page, re-read the text file before writing it.
- Every `uses` and `nameOrigin` is in your own words. Never copy sentences or long phrases from the page.
- A page that is only a menu, an index or an empty frame still gets a draft: its `pageType` and empty lists.
- Poems and fiction: `story`, and only relations the text clearly states about real people and places.
