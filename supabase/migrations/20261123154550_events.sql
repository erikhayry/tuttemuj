-- Phase 2 (#3): events, and events per place in /nearby.
--
-- Mirrors EventMention in packages/schema. Holds our own short event descriptions, dates and
-- links back to the source page. Never page text.

create table public.events (
  -- "<source url>#<n>": the n-th event on that page.
  id           text primary key,
  page_url     text not null references public.pages (source_url) on delete cascade,
  title        text not null,
  -- Null when the page gives no date. month, day and end_year only mean something with a year.
  year         integer,
  month        smallint check (month between 1 and 12),
  day          smallint check (day between 1 and 31),
  end_year     integer check (end_year is null or end_year > year),
  circa        boolean not null default false,
  description  text,
  -- Names as written on the page (PersonMention.name). People get their own table later.
  people       text[] not null default '{}'
);

create index events_page_idx on public.events (page_url);

create table public.event_places (
  event_id  text not null references public.events (id) on delete cascade,
  place_id  text not null references public.places (id) on delete cascade,
  primary key (event_id, place_id)
);

create index event_places_place_idx on public.event_places (place_id);

alter table public.events enable row level security;
alter table public.event_places enable row level security;

-- /nearby now also returns each place's events in date order. The return type changes, so the
-- function is replaced.
drop function public.nearby_places(double precision, double precision, integer, integer, integer);

create function public.nearby_places(
  in_lat double precision,
  in_lng double precision,
  in_radius_m integer,
  in_max_places integer default 50,
  in_max_pages integer default 10,
  in_max_events integer default 10
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
  pages jsonb,
  event_count integer,
  events jsonb
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
       ) x),
    -- Events on duplicate pages are skipped: the primary page has them.
    (select count(*)::integer
       from public.event_places ep
       join public.events e on e.id = ep.event_id
       join public.pages pg on pg.source_url = e.page_url
      where ep.place_id = n.id and pg.duplicate_of is null),
    (select coalesce(jsonb_agg(x.j order by x.year, x.month, x.day, x.title, x.id), '[]'::jsonb)
       from (
         select e.id, e.year, e.month, e.day, e.title,
                jsonb_strip_nulls(jsonb_build_object(
                  'sourceUrl', e.page_url,
                  'title', e.title,
                  'description', e.description,
                  'date', case when e.year is null then null else jsonb_build_object(
                            'year', e.year, 'month', e.month, 'day', e.day,
                            'endYear', e.end_year, 'circa', e.circa) end
                )) as j
           from public.event_places ep
           join public.events e on e.id = ep.event_id
           join public.pages pg on pg.source_url = e.page_url
          where ep.place_id = n.id and pg.duplicate_of is null
          order by e.year, e.month, e.day, e.title, e.id
          limit in_max_events
       ) x)
  from near n
  order by n.distance_m, n.id;
$$;

revoke execute on function public.nearby_places(double precision, double precision, integer, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.nearby_places(double precision, double precision, integer, integer, integer, integer)
  to service_role;
