# Tuttemuj

An app where a person walking around Nykarleby can ask "what happened here?" (or other questions about the town's history). The answers are built from https://www.nykarlebyvyer.nu.

## Core principle

**Tuttemuj sends people to nykarlebyvyer.nu. It never replaces the site.**

- Store only derived facts (entities, dates, coordinates), our own short summaries and source URLs.
- Never commit or republish page text. Raw HTML stays in `.cache/`, which is gitignored.
- Every fact and every answer must be traceable to a `sourceUrl`, and the user must be shown that link.

## Crawling

- The site owner is OK with **polite** crawling: one request at a time, a delay of several seconds between requests, and an honest User-Agent.
- About 50 URLs per night. We do not need the whole site before launch.

## Conventions

- A TypeScript pnpm monorepo: `apps/*` are runnable apps, `packages/*` are shared libraries.
- **All types are Zod schemas** in `packages/schema`. Get static types with `z.infer`. Do not write interfaces that duplicate a schema. Validate data at every I/O boundary (files, HTTP, the Claude API, the database).
- Run TS directly with `tsx` and use `.ts` import extensions. `tsc` is used only for type-checking.
- Biome handles lint and format (`pnpm format`). Vitest handles tests (`*.test.ts` next to the source).
- Use conventional commits (`feat:`, `fix:`, `chore:`, `docs:`) and a branch per change, opened as a PR to `main`.
- Source data is Swedish. The user-facing apps are multi-language (sv, fi, en to start).

## Commands

- `pnpm install`
- `pnpm lint` / `pnpm format`
- `pnpm typecheck`
- `pnpm test`

## Roadmap

Each GitHub epic is one issue labelled `epic`:

- #1 setup
- #2 Phase 1: crawl and extract
- #3 Phase 2: RAG and API on Supabase
- #4 Phase 3: web app
- #5 Phase 4: native iOS and Android apps
