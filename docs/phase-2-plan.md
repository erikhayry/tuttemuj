# Phase 2 plan: knowledge base and API

Epic: #3. This plan refines the epic's task list using what Phase 1 has produced so far.

## Goal

Answer "what happened here?" and other history questions for a person walking around Nykarleby. Every answer is short, grounded in our extracted facts, and links to the pages on nykarlebyvyer.nu.

## Where we are (2026-11-15)

| Data | Count |
| --- | --- |
| Pages analysed (`data/pages`) | 311 of ~8,400 known URLs |
| People mentioned | 1,523 |
| Events | 846 |
| Place mentions | 1,667, of which 452 (27%) have coordinates |
| Gazetteer names | 1,227, of which 327 have coordinates |
| Gazetteer names waiting for coordinates | 670 added by hand, 23 geocoder fallbacks, 1 outside the area |
| Comic candidates | 37 |

The crawl adds about 250 pages a night (about 30 more nights). Analysis is manual and slower. **Phase 2 does not wait for the crawl to finish.** It is built on what exists and loads new pages as they come.

**Timeline:** a couple more days of crawling and extraction, then the focus moves to coordinates (step 0, first item). The nightly crawl keeps running in the background.

## Decisions

1. **Geo first, semantic second.** Most questions are about a location. A PostGIS query ("places within 150 m, their events by date") answers them directly. Vector search over text is for questions without a location, or when nothing is near.
2. **No page text in the database.** The corpus is only what we wrote: summaries, event titles and descriptions, place and person descriptions, and comic pitches. This settles the epic's open question ("private chunks vs live fetch") in favour of neither. The site stays the place to read. We can revisit this if answers are too thin, but only with the site owner's agreement.
3. **One Postgres (Supabase) with PostGIS and pgvector.** No separate vector store.
4. **Git stays the source of truth.** `data/` is loaded into Supabase by an idempotent sync job. The database can be rebuilt from git at any time.
5. **Claude writes the answers** from retrieved facts only, in sv, fi or en, and must cite a `sourceUrl` for every claim.

## Work, in order

### 0. Data readiness (in this repo, before Supabase)

These matter more for answer quality than more crawled pages.

- **Coordinates for the most-mentioned places.** Start with the top ~100 unlocated places by number of pages, e.g. Torget (21 pages), Grev Tottgatan (14), Brunnsholmarna (13), Rådhuset, Klockstapeln and Storbron (11 each), Topeliusparken, Nystaden, Juthbacka and Kuddnäs. Add them to `data/sources/manual-places.json`, then run `gazetteer:build` and `places:geocode`. A small helper that lists unlocated places ranked by number of pages would make this easy.
- **Entity resolution.** Merge the same person or place across pages into one canonical entity with stable ids, e.g. "Albert Dyhr" / "Alb. Dyhr" / "rådman Albert Dyhr". Use rules (normalised names, life years, roles) and flag uncertain merges for manual review, the same way the gazetteer works. Output: `data/entities/people.json`, `data/entities/places.json` with `pageIds` and aliases. Places can reuse the gazetteer as their backbone.
- **Duplicate pages.** Link Swedish/English caption pairs and full-size/thumbnail map pages (e.g. `kyrkan`/`kyrkae`, `1866kran`/`1866krax`) so answers don't repeat the same fact. Add `duplicateOf` or a `pageGroup` field.
- **Date ranges.** Add an optional `endYear` (and maybe `century`) to `HistoricalDate`. "1873–1971" and "the 17th century" currently lose information.
- **Thin early summaries.** Re-run `/extract-pages` on the first ~50 map pages if summaries turn out too thin in the eval (bump `EXTRACTION_VERSION` only for the fields that changed).

### 1. Database and sync

- Supabase project with the PostGIS and pgvector extensions.
- Tables: `pages`, `places` (geometry point, kind, aliases), `people`, `events` (with date range), plus join tables `page_places`, `page_people`, `event_places`, `event_people`, and `embeddings`.
- The schema mirrors the Zod schemas in `packages/schema`. Generate or verify the TS types, and validate rows with Zod in the sync job.
- `pnpm --filter @tuttemuj/loader sync`, a new app in `apps/loader`: reads `data/pages`, `data/gazetteer.json` and `data/entities`, then upserts by stable id and deletes what's gone. It runs after commits to `data/` (locally or in CI).

### 2. Retrieval

- **Nearby:** `GET /nearby?lat&lng&radius` returns places within the radius with their events sorted by date, plus the pages that mention them.
- **Embeddings:** one vector per summary, event and comic pitch, each linked to its page. Use a multilingual embedding model so fi and en questions find Swedish text.
- **Hybrid ranking:** distance first, then vector similarity, then a bonus for richer pages (more events, a comic candidate).

### 3. Answer API

- `POST /ask { lat?, lng?, question, lang }` with Zod-validated request and response.
- Retrieval → a prompt containing only retrieved facts and their `sourceUrl` → Claude answer (2–5 sentences) with numbered citations.
- If the facts don't answer the question, say so and suggest the nearest pages instead of guessing.
- `GET /entity/:id` returns a person or place with its pages and events.
- No endpoint returns page text.

### 4. Quality and cost

- **Eval set** of about 50 questions with expected sources, in sv, fi and en. Mix location questions ("standing at Torget"), entity questions ("who was Esas Liisa?") and topics ("fires in Nykarleby"). Run it on every change to retrieval or prompts.
- Rate limiting per client, a cache for repeated location queries, and a cap on retrieved facts per answer.
- Logging of questions that got no grounded answer. These tell us which pages to analyse next or which places need coordinates.

## Acceptance criteria (from the epic, made concrete)

- `/ask` at Torget, Storbron, Brostugan and Andrasjön returns a grounded answer with at least one source link.
- Answers in Swedish, Finnish and English, all citing Swedish source pages.
- No endpoint returns full source page text.
- The eval set has at least 80% of answers citing an expected source.

## Not in Phase 2

- Fetching more of the site or analysing it faster. That continues in parallel.
- The web and native apps (Phases 3 and 4).
- The comics project. It can read `comicCandidate` from `data/pages` or later from the API.

## Open questions for the user

- Supabase region and project ownership (personal or organisation).
- Which embedding model: hosted multilingual model vs a local one.
- Whether answers may quote short phrases from summaries we wrote (yes) and from page titles (probably yes).
