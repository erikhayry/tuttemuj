-- Phase 2 (#3): one vector per page summary, event and comic pitch, for /ask.
--
-- Model: Voyage voyage-4, 1024 dimensions, stored as half precision (halfvec) to save space.
-- The embedded text is derived from our own summaries and is not stored here, only its hash,
-- so the embed job can tell what changed. Never page text.

create table public.embeddings (
  kind       text not null check (kind in ('page', 'event', 'comic')),
  -- The page's source URL for 'page' and 'comic', the event id for 'event'.
  ref        text not null,
  -- The page to cite. Embeddings go when the page goes.
  page_url   text not null references public.pages (source_url) on delete cascade,
  text_hash  text not null,
  model      text not null,
  embedding  extensions.halfvec(1024) not null,
  primary key (kind, ref)
);

create index embeddings_page_idx on public.embeddings (page_url);
create index embeddings_vector_idx on public.embeddings
  using hnsw (embedding extensions.halfvec_cosine_ops);

alter table public.embeddings enable row level security;

-- The closest embeddings to a question vector (cosine distance, 0 = same direction).
create function public.search_embeddings(
  in_embedding extensions.halfvec(1024),
  in_limit integer default 20
)
returns table (kind text, ref text, page_url text, distance double precision)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.kind, e.ref, e.page_url,
         (e.embedding operator(extensions.<=>) in_embedding)::double precision as distance
    from public.embeddings e
   order by e.embedding operator(extensions.<=>) in_embedding
   limit in_limit;
$$;

revoke execute on function public.search_embeddings(extensions.halfvec, integer)
  from public, anon, authenticated;
grant execute on function public.search_embeddings(extensions.halfvec, integer)
  to service_role;
