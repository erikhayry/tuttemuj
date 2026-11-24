# Extraction versions

`/extract-pages` is versioned. The `version` in `.claude/skills/extract-pages/SKILL.md` must equal `EXTRACTION_VERSION` in `packages/schema/src/entities.ts` (checked by `apps/crawler/src/extract/skill-version.test.ts`). Each page file in `data/pages/` records the version that produced it in `extractionVersion`.

`pnpm --filter @tuttemuj/crawler extract:next` picks pages that have no extraction, whose content changed, or whose `extractionVersion` is lower than the current one. So bumping the version queues every older page, and old data can be redone a version at a time (`extract:next <count>`).

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

Add-on passes (`/enrich-pages`, #54) get their own versions here once they exist.
