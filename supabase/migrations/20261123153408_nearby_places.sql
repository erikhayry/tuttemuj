-- Phase 2 (#3): places near a point, with the pages that mention them (GET /nearby).
--
-- Returns our own titles and summaries and the source URLs, never page text.
-- Duplicate pages (pages.duplicate_of) are folded into their primary page.

create function public.nearby_places(
  in_lat double precision,
  in_lng double precision,
  in_radius_m integer,
  in_max_places integer default 50,
  in_max_pages integer default 10
)
returns table (
  id text,
  name text,
  kind text,
  aliases text[],
  lat double precision,
  lng double precision,
  distance_m double precision,
  page_count integer,
  pages jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  with origin as (
    select extensions.st_setsrid(extensions.st_point(in_lng, in_lat), 4326)::extensions.geography as g
  ),
  near as (
    select p.id, p.name, p.kind, p.aliases, p.location,
           extensions.st_distance(p.location, o.g) as distance_m
    from public.places p, origin o
    where extensions.st_dwithin(p.location, o.g, in_radius_m)
    order by distance_m, p.id
    limit in_max_places
  )
  select
    n.id, n.name, n.kind, n.aliases,
    extensions.st_y(n.location::extensions.geometry),
    extensions.st_x(n.location::extensions.geometry),
    n.distance_m,
    (select count(distinct coalesce(pg.duplicate_of, pg.source_url))::integer
       from public.page_places pp
       join public.pages pg on pg.source_url = pp.page_url
      where pp.place_id = n.id),
    (select coalesce(jsonb_agg(jsonb_build_object(
              'sourceUrl', x.source_url, 'title', x.title, 'summary', x.summary)
              order by x.source_url), '[]'::jsonb)
       from (
         select distinct on (prim.source_url) prim.source_url, prim.title, prim.summary
           from public.page_places pp
           join public.pages pg on pg.source_url = pp.page_url
           join public.pages prim on prim.source_url = coalesce(pg.duplicate_of, pg.source_url)
          where pp.place_id = n.id
          order by prim.source_url
          limit in_max_pages
       ) x)
  from near n
  order by n.distance_m, n.id;
$$;

-- Only the API server (service role) calls this.
revoke execute on function public.nearby_places(double precision, double precision, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.nearby_places(double precision, double precision, integer, integer, integer)
  to service_role;
