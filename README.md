# tuttemuj

_Va skeed jäär?_

Walk around Nykarleby and ask "what happened here?". The answers are built from the history collected on [Nykarlebyvyer](https://www.nykarlebyvyer.nu), and every answer links back to the original page.

## Phases

1. **Crawl and extract:** a polite nightly crawl, with Claude extracting people, places, dates and events. ([#2](../../issues/2))
2. **Knowledge base and API:** RAG on Supabase (Postgres, PostGIS and pgvector). ([#3](../../issues/3))
3. **Web app:** mobile-first and multi-language. ([#4](../../issues/4))
4. **Native apps:** iOS and Android. ([#5](../../issues/5))

## Development

Requires Node 24 or later and pnpm.

```sh
pnpm install
pnpm lint && pnpm typecheck && pnpm test
```

Copy `.env.example` to `.env` and fill in the keys. See [CLAUDE.md](CLAUDE.md) for conventions.
