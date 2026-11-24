# Extraction versions

`/extract-pages` is versioned. The `version` in `.claude/skills/extract-pages/SKILL.md` must equal `EXTRACTION_VERSION` in `packages/schema/src/entities.ts` (checked by `apps/crawler/src/extract/skill-version.test.ts`). Each page file in `data/pages/` records the version that produced it in `extractionVersion`.

`pnpm --filter @tuttemuj/crawler extract:next` picks pages that have no extraction, whose content changed, or whose `extractionVersion` is lower than the current one. So bumping the version queues every older page, and old data can be redone a version at a time (`extract:next <count>`). Pages with `pageType` `empty` or `menu` are the exception: they are only redone when their content changes, never for a version bump.

## When to bump

Bump when the instructions or the draft schema change in a way that makes old pages worth redoing: new fields, a different way of writing summaries, a new rule for dates. Do not bump for typo fixes or for changes that old pages can simply live without. Bump the skill's `version` and `EXTRACTION_VERSION` together, then add a section below.

## Versions

### 1 (current)

The first full extraction. Per page:

- `summary` in Swedish (2–3 sentences, first sentence stands alone), `topics`.
- `people` with optional birth and death years, roles and alternate names.
- `places` with kind, address and alternate names. Coordinates (`geo`) are added by `extract:save` from the gazetteer, never by the analyst.
- `events` with a date as precise as the page allows (`year`, `month`, `day`, `circa`, `endYear` for spans, original wording in `text`), and the people and places involved.
- `comicCandidate`: always decided (`null` or a candidate with pitch and reason).
- Only facts the page states. Nothing is filled in from memory.

### Next (not released): v1 fields in the full extraction

The schema accepts these optional fields (#53). `/extract-pages` does not ask for them yet and `EXTRACTION_VERSION` is not bumped, so no page is queued again. #55 updates that skill and bumps the version for new pages. Old pages get the same fields from `/enrich-pages` (below).

- `pageType`: empty, photo, postcard, map, story, article, list or menu. `empty` and `menu` are already set on old pages by a rule on our own summary (`pages:mark-no-content`), and `extract:save` sets them on new pages.
- `relations`: person–place relations (lived, owned, built, ran, worked, born, died) with `startYear` and `endYear` when stated.
- `images`: per image (`[bild n]`), the places it shows and its year. Whether an image is a photo, and whether it shows buildings or people, is answered per image by Jev (`docs/images.md`), not here.
- On each place: `uses` (what it was used for, with years) and `nameOrigin`.

Missing means "not assessed"; an empty list means "assessed, nothing found". On a page with an `enrichments` stamp, every place was assessed, so a place without `uses` has none.

## Enrichment versions

`/enrich-pages` adds the v1 fields to pages that were extracted before them, without redoing the page. The `version` in `.claude/skills/enrich-pages/SKILL.md` must equal `ENRICH_VERSION` in `packages/schema/src/entities.ts` (checked by the same test). A page it has done carries `enrichments: [{ skill, version, model, enrichedAt }]`.

`pnpm --filter @tuttemuj/crawler enrich:next` picks pages that were extracted before v1 (no `pageType`) or that have an older enrichment stamp. It skips empty pages and menus, and pages whose content changed on the site (`/extract-pages` redoes those in full). An enriched page is not queued again when `EXTRACTION_VERSION` is bumped: it already has the fields the bump was for.

Bump `ENRICH_VERSION` and the skill's `version` together when the instructions or the draft change so that enriched pages are worth redoing.

### enrich 1 (current)

The first add-on pass, per page: `pageType` (always), `relations`, `images` (only images the page says something about) and, on places that have them, `uses` and `nameOrigin`. Only facts the page states. People and places are never added: names must match the ones already on the page.
