# Tuttemuj

An app where a person walking around Nykarleby can ask "what happened here?" (or other questions about the town's history). The answers are built from https://www.nykarlebyvyer.nu.

v1 (see `docs/v1-plan.md`) has no AI: the user allows location and picks from 10 ready-made buttons ("Vem bodde här?", "Visa gamla bilder härifrån"…), answered with plain database queries. Swedish only in v1. Free-text questions with AI answers are v2.

## Core principle

**Tuttemuj sends people to nykarlebyvyer.nu. It never replaces the site.**

- Store only derived facts (entities, dates, coordinates), our own short summaries and source URLs.
- Never commit or republish page text. Raw HTML stays in `.cache/`, which is gitignored.
- Every fact and every answer must be traceable to a `sourceUrl`, and the user must be shown that link.
- The site owner has agreed that the app may show the site's images. Load them from nykarlebyvyer.nu and link each to its page; never download or rehost them.

## Crawling

- The site owner is OK with **polite** crawling: one request at a time, a delay of several seconds between requests, and an honest User-Agent.
- About 1000 URLs per night. We do not need the whole site before launch.

## Data analysis

The analysis runs in Claude Code with the `/extract-pages` skill, on the user's subscription (by hand or in the nightly extract job). No Anthropic API key is used.

- Data skills are versioned: when a skill's instructions or output change, bump its `version` and the matching constant in `packages/schema`, and record the change in `docs/extraction-versions.md`. Each page file records which skill version produced it.

## Conventions

- A TypeScript pnpm monorepo: `apps/*` are runnable apps, `packages/*` are shared libraries.
- **All types are Effect Schema schemas** in `packages/schema`. Get static types from the schema (`typeof X.Type`). Do not write interfaces that duplicate a schema. Validate data at every I/O boundary (files, HTTP, the Claude API, the database). `packages/schema` is fully Effect Schema (#49). Zod remains only in the apps' own local schemas (env config, database rows) until #50; write new code with Effect Schema. Decode with `Schema.decodeUnknownSync(X)(value)`; `safeDecode(X)(value)` from `@tuttemuj/schema` is a bridge for code that still branches on success.
- [Effect](https://effect.website) for server and shared logic. [Foldkit](https://foldkit.dev) for the UI.
- **Teach Effect and Foldkit in comments.** The owner is learning both. In Effect and Foldkit code, add short comments that say what a construct does and why it is used. Compare with React or Zod when that makes it clearer (e.g. "like Zod's `.default()`, but the default is an Effect"). Comment the non-obvious idea once, where it first appears. Do not comment every line or repeat an explanation that is already in the file.
- **Foldkit examples.** Before the first Foldkit UI code in a session, make sure `examples/foldkit` exists (the clone command is in issue #60; `examples/` is gitignored). Read the examples that match the task before writing the code.
- Run TS directly with `tsx` and use `.ts` import extensions. `tsc` is used only for type-checking.
- Biome handles lint and format (`pnpm format`).
- **No unit tests.** Test features end to end and test properties (see `docs/testing.md`): Playwright for UI and API feature tests (one test per feature, not per line), Bombadil for UI property tests, generated requests for API property tests. Tests run against a local seeded Supabase, never production. Existing Vitest unit tests are replaced as their code moves to Effect.
- Use conventional commits (`feat:`, `fix:`, `chore:`, `docs:`) and a branch per change, opened as a PR to `main`.
  - Exception: data-only commits (`data:`), i.e. `/extract-pages` results and the nightly crawl, are committed and pushed straight to `main`, with no branch or PR.
- Source data is Swedish. The user-facing apps are multi-language (sv, fi, en to start), but v1 ships Swedish only. All UI text comes from per-language message catalogs keyed by id; API responses carry ids and data, never UI text.

## Commands

- `pnpm install`
- `pnpm lint` / `pnpm format`
- `pnpm typecheck`
- `pnpm test`
- `pnpm data:rebuild`: rebuild the derived files in `data/` (offline). `pnpm data:publish`: that, then sync to Supabase and embed with Voyage (needs `.env` keys, writes to production)

## Roadmap

Each GitHub epic is one issue labelled `epic`:

- #1 setup
- #2 Phase 1: crawl and extract
- #48 v1: location buttons, Swedish, no AI (mobile web/PWA)
- v1.1: Finnish and English
- #3 v2: free-text questions with AI (RAG and API on Supabase)
- #4 Phase 3: web app
- #5 Phase 4: native iOS and Android apps

## Agent output style

All agent text to the owner (replies, summaries, PR text) follows the ADHD output style from <https://github.com/ayghri/i-have-adhd/blob/main/skills/i-have-adhd/SKILL.md>. In short:

- Lead with the next action or the result. No preamble, recap or closing pleasantries.
- Number multi-step work. End with one concrete next action.
- Keep lists to at most 5 items per group. Skip tangents.
- Give specific time estimates. Show finished work.
- State errors plainly, without drama.
- Break these rules only for explanations, destructive actions, real ambiguity, or when a rule would delete the answer.
