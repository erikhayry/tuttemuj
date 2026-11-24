---

name: extract-pages
version: 2
description: Analyse crawled nykarlebyvyer.nu pages into structured data (people, places, events, dates, summary, page type, person–place relations, place uses, image facts) in data/pages. Use when the user asks to analyse, extract or process crawled pages, e.g. "/extract-pages 20".
---

# Extract pages

Turn crawled pages into structured facts that validate against `PageExtractionDraft` (`packages/schema/src/entities.ts`). The argument is the number of pages to do. If no number is given, do 10.

**Versioning.** `version` above must equal `EXTRACTION_VERSION` in `packages/schema/src/entities.ts` (a test checks this). When you change these instructions or the draft schema so that old pages should be redone, bump both and describe the change in `docs/extraction-versions.md`. `extract:next` then picks every page saved with an older version, except pages from before the v1 fields: `/enrich-pages` brings those up to date instead.

## Steps

1. Run `pnpm --filter @tuttemuj/crawler extract:next <count>`. It prints each page's text file and draft path.
   - The JSON Schema for drafts is in `.cache/extract/draft.schema.json`. Read it once.
2. For each page:
   - Read its text file. Large images are marked `[bild n]` in the text.
   - Write a draft JSON file to its `draftPath`.
   - To save context, do the pages one by one. Don't read them all first.
3. Run `pnpm --filter @tuttemuj/crawler extract:save`.
   - It validates each draft and moves it to `data/pages/`.
   - If a draft is invalid, fix it and run the save again until nothing is invalid.
4. Add new places to the gazetteer:
   - Run `pnpm --silent --filter @tuttemuj/crawler places:unmatched` (prints JSON). It lists places that have no coordinates and whose names are not in `data/gazetteer.json` or `data/sources/ignored-places.json`.
   - Add **every place that is in Nykarleby** (town, villages, archipelago) to `data/sources/manual-places.json`, even without coordinates; the user adds coordinates or aliases later. Use a lowercase `name`, the closest `kind`, spelling variants as `alternateNames`, and a short English `note` if it helps (e.g. "Farm in Vexala.").
   - If it is the same place as an existing gazetteer entry, add the page's name as an alternate name of that entry instead of a new entry (e.g. Normalskolan → `normen`).
   - Generic names that recur in several villages (Torp, Bäck, Klockars…) get a qualified entry (`klockars i vexala`) and the same qualified name as an `alternateName` on the page's place.
   - Places outside Nykarleby or too vague to locate (Kvarken, Centrum, Tomt 10) go in `data/sources/ignored-places.json`.
   - Then run `gazetteer:build` and `places:geocode`, and check that `places:unmatched` prints nothing.
5. Run `pnpm data:rebuild`. It rebuilds the gazetteer, coordinates, place entities and page groups from `data/` (offline, no keys), so the derived files in `data/entities/` match the new pages. Commit them with the extract results.
6. Report how many pages were saved. Also note anything interesting, such as pages that are only menus or index pages, or cases where the schema doesn't fit the content well.
7. Remind the user to run `pnpm data:publish` when they want the new data in Supabase and Voyage. Do not run it yourself: it writes to the production database and calls the Voyage API.

## Draft fields

- `sourceUrl`: copy it exactly from the batch.
- `title`: the page title, cleaned up.
- `model`: your model id, e.g. `claude-opus-5-5`.
- `summary`: **in Swedish, in your own words.** Users read it directly in search results, so write it for a person standing in the town.
  - A page with real content gets 2–3 sentences (roughly 200–350 characters). Lead with who, what, where and when, using the names, places and years the page states. Never fill gaps from memory.
  - The first sentence must stand on its own and stay under about 140 characters: it is shown alone as the result teaser.
  - Photos and postcards with little text can have 1–2 sentences.
  - Never copy sentences or long phrases from the page, and don't retell the whole page. The app sends readers to the original, so the summary should make them want to click.
  - A page with no content of its own (an empty page, a menu, a frame, an index, an enlargement) gets one sentence that says so, using one of these phrases so it is recognised and left out of search: "Nästan tom sida…", "Menysida…", "Ramsida…", "Innehållsförteckning…", "Sidan har ingen egen text…".
- `topics`: a few short lowercase Swedish keywords, e.g. `"handel"`, `"kyrka"`, `"1808–09 års krig"`.
- `people`: every named person who matters to the page.
  - Give `birthYear`/`deathYear` only when the page states them.
  - `roles` covers things like occupation and title ("rådman", "skeppsbyggare").
  - Put spelling variants in `alternateNames`.
- `pageType`: **always set it.** Pick the one that fits best:
  - `photo` (mainly photographs with captions), `postcard` (vykort), `map` (a map, plan or chart), `story` (a memory, a tale, a personal account), `article` (a factual text about a topic, person, building or event), `list` (a register, table or list of names, houses or items), `menu` (only links to other pages), `empty` (no content of its own: a frame, a lone logo, an empty page).
- `places`: streets, buildings, farms, districts, landmarks, waters, islands (incl. holmar, skär, ören) and villages.
  - Never write `geo`. `extract:save` adds coordinates by matching `address`, `name` and `alternateNames` against `data/gazetteer.json` (modern names). When the page gives a modern name, add it to `alternateNames` so the place can be located.
  - Pick the closest `kind`.
  - `address`: copy it as written (old addresses are valuable). Add today's address in the `description` only if the page gives it.
  - Places that are tied to a physical spot in Nykarleby are the most important, since the app answers "what happened here?".
  - `uses`: what the place was used for, each as `use` (one short lowercase Swedish noun, such as "apotek", "skola", "bageri") with `startYear` and `endYear` when stated. Only uses the page states. Leave the field out when there are none.
  - `nameOrigin`: where the place's name comes from, in **your own words, one Swedish sentence**. Only when the page explains it.
- `events`: things that happened, each with a `date` as precise as the page allows.
  - `year` is required.
  - Set `circa: true` for "omkring", "ca" and similar.
  - Put the original wording in `date.text`.
  - For a span the page states ("1873–1971", "på 1830-talet", "1600-talet"), put the first year in `year` and the last in `endYear`. A decade is 1830–1839 and a century 1800–1899. Leave `endYear` out for a single year, and when the page only says "början av 1830-talet" or similar, since that is not the whole decade.
  - `description`: one self-contained sentence in Swedish, in your own words, that makes sense without the page: say what happened and name the place and the people when the page does.
  - `people` and `places` reference names used in the lists above.

- `relations`: **always set it** (`[]` when the page states none). How a person in `people` is tied to a place in `places`; both names must be exactly as written in those lists.
  - `relation` is one of: `lived` (bodde), `owned` (ägde), `built` (byggde eller lät bygga), `ran` (drev, e.g. a shop, inn or business), `worked` (arbetade där), `born` (föddes där), `died` (dog där).
  - `startYear` and `endYear` only when the page states them. "Bodde där till 1920" has only `endYear: 1920`. A single year is the same value in both.
  - Only what the page says. A place called "X:s gård" does not by itself say that X owned or lived there.
  - One entry per person, place and relation.
- `images`: **always set it** (`[]` when the page says nothing about its images). Only images the page says something about.
  - `image` is the number in `[bild n]`.
  - `places`: names from `places` that the image shows, when the page says so. A caption that names a street or a building counts.
  - `year`: the year the image was made or shows, only when stated. "195X" or "1950-talet" is not a year: leave it out.
  - Leave out images with no stated place and no year.
- `comicCandidate`: **always set it**: `null`, or an object if the page tells a story that could become a comic. The user turns local stories into comics in another project.
  - A candidate has people (named or not) and something happening to them: a conflict, a danger, a turning point, a vivid scene or a strong memory. Lists, map captions and plain facts are `null`.
  - `potential`: `"high"` when the page itself carries the story (a scene, dialogue, a sequence of events, personal memories); `"medium"` when the page has a strong story seed but only a few lines of it.
  - `pitch`: the story in your own words, in Swedish, 1–3 sentences. `reason`: why it works as a comic, in Swedish, one sentence.
  - `characters` and `places` reference names used in `people` and `places`.

## Rules

- Only include facts stated on the page. Don't add outside knowledge or guesses.
- Never make things up. If a value (a date, year, day, name, role, location, kind) is not stated on the page, leave the field out. Don't fill gaps from memory, don't infer a day or month from a year, and don't add birth or death years for well-known people. If unsure whether something is on the page, re-read the text file before writing it.
- Menus, index pages and pages with almost no text still get a draft: a one-sentence summary saying what the page lists, and empty arrays.
- Poems and fiction: summarise the theme, and only extract real people and places.
- Never put long passages of page text in the output.
