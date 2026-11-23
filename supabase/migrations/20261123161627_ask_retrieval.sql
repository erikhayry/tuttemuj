-- Phase 2 (#3): retrieval helper for POST /ask.
--
-- How close is a question to each of these pages? Used to rank the pages around the user's
-- location by meaning, next to the pages the vector search finds anywhere.

create function public.page_similarity(
  in_embedding extensions.halfvec(1024),
  in_pages text[]
)
returns table (page_url text, distance double precision)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.page_url,
         min((e.embedding operator(extensions.<=>) in_embedding)::double precision) as distance
    from public.embeddings e
   where e.page_url = any (in_pages)
   group by e.page_url;
$$;

revoke execute on function public.page_similarity(extensions.halfvec, text[])
  from public, anon, authenticated;
grant execute on function public.page_similarity(extensions.halfvec, text[])
  to service_role;
