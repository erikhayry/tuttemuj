-- v1 (#48, #57): one function per button, and a function that says which buttons have results.
--
-- Every function takes the user's position and a radius in metres and returns facts with
-- `source_url`, so the app can always link to nykarlebyvyer.nu. Functions return ids and data,
-- never UI text. Duplicate pages (pages.duplicate_of) are left out: the primary page has the same
-- facts. Only our own summaries and derived facts, never page text.

-- Which images a page has, and what Jev said about each (data/images.jsonl). One row per large image,
-- numbered like the `[bild n]` markers. The image itself is never stored: `url` points at the site.
create table public.page_images (
  page_url         text not null references public.pages (source_url) on delete cascade,
  -- Position among the page's large images, starting at 1 (same n as image_facts.image_number).
  image_number     integer not null check (image_number > 0),
  url              text not null check (url like 'https://www.nykarlebyvyer.nu/%'),
  width            integer not null,
  height           integer not null,
  -- Jev's answers (0 to 1), null until the image has been classified or when it was skipped.
  photo            real check (photo between 0 and 1),
  building_visible real check (building_visible between 0 and 1),
  people_visible   real check (people_visible between 0 and 1),
  -- A photograph with a building or people in it (isShowableImage). Shown in "old images".
  showable         boolean not null default false,
  primary key (page_url, image_number)
);

create index page_images_url_idx on public.page_images (url);
alter table public.page_images enable row level security;

-- The located places within `in_radius_m` of a point, nearest first. The building block of the buttons.
create function public.near_places(in_lat double precision, in_lng double precision, in_radius_m integer)
returns table (place_id text, place_name text, kind text, distance_m double precision)
language sql stable security invoker set search_path = ''
as $$
  select p.id, p.name, p.kind,
         extensions.st_distance(p.location, o.g)
    from public.places p,
         (select extensions.st_setsrid(extensions.st_point(in_lng, in_lat), 4326)::extensions.geography as g) o
   where extensions.st_dwithin(p.location, o.g, in_radius_m)
$$;

-- 1. who-lived-here: people who lived at or owned a place nearby, with years.
create function public.button_who_lived_here(
  in_lat double precision, in_lng double precision, in_radius_m integer, in_limit integer default 50)
returns table (place_id text, place_name text, distance_m double precision, person_name text,
               relation text, start_year integer, end_year integer, source_url text, page_title text)
language sql stable security invoker set search_path = ''
as $$
  select n.place_id, n.place_name, n.distance_m, r.person_name, r.relation, r.start_year, r.end_year,
         pg.source_url, pg.title
    from public.near_places(in_lat, in_lng, in_radius_m) n
    join public.person_place_relations r on r.place_id = n.place_id and r.relation in ('lived', 'owned')
    join public.pages pg on pg.source_url = r.page_url and pg.duplicate_of is null
   order by n.distance_m, n.place_id, r.start_year nulls last, r.person_name
   limit in_limit
$$;

-- 2. what-happened-here: events at nearby places, oldest first.
create function public.button_what_happened_here(
  in_lat double precision, in_lng double precision, in_radius_m integer, in_limit integer default 50)
returns table (place_id text, place_name text, distance_m double precision, event_id text, title text,
               year integer, month smallint, day smallint, end_year integer, circa boolean,
               description text, source_url text, page_title text)
language sql stable security invoker set search_path = ''
as $$
  select * from (
    select distinct on (e.id) n.place_id, n.place_name, n.distance_m, e.id as event_id, e.title, e.year,
           e.month, e.day, e.end_year, e.circa, e.description, pg.source_url, pg.title as page_title
      from public.near_places(in_lat, in_lng, in_radius_m) n
      join public.event_places ep on ep.place_id = n.place_id
      join public.events e on e.id = ep.event_id
      join public.pages pg on pg.source_url = e.page_url and pg.duplicate_of is null
     order by e.id, n.distance_m
  ) s
  order by s.year nulls last, s.month nulls last, s.day nulls last, s.event_id
  limit in_limit
$$;

-- 3. stories-from-here: pages of type story, or with a comic pitch, about nearby places.
create function public.button_stories_from_here(
  in_lat double precision, in_lng double precision, in_radius_m integer, in_limit integer default 50)
returns table (place_id text, place_name text, distance_m double precision, source_url text,
               title text, summary text, page_type text)
language sql stable security invoker set search_path = ''
as $$
  select * from (
    select distinct on (pg.source_url) n.place_id, n.place_name, n.distance_m, pg.source_url, pg.title,
           pg.summary, pg.page_type
      from public.near_places(in_lat, in_lng, in_radius_m) n
      join public.page_places pp on pp.place_id = n.place_id
      join public.pages pg on pg.source_url = pp.page_url and pg.duplicate_of is null
     where pg.page_type = 'story' or pg.comic_candidate is not null
     order by pg.source_url, n.distance_m
  ) s
  order by s.distance_m, s.source_url
  limit in_limit
$$;

-- 4. old-images-from-here: showable photos that a page says show a nearby place, with year.
create function public.button_old_images_from_here(
  in_lat double precision, in_lng double precision, in_radius_m integer, in_limit integer default 50)
returns table (place_id text, place_name text, distance_m double precision, image_url text, year integer,
               source_url text, page_title text)
language sql stable security invoker set search_path = ''
as $$
  select * from (
    select distinct on (im.url) n.place_id, n.place_name, n.distance_m, im.url as image_url, f.year,
           pg.source_url, pg.title as page_title
      from public.near_places(in_lat, in_lng, in_radius_m) n
      join public.image_fact_places fp on fp.place_id = n.place_id
      join public.image_facts f on f.id = fp.image_id
      join public.page_images im on im.page_url = f.page_url and im.image_number = f.image_number and im.showable
      join public.pages pg on pg.source_url = f.page_url and pg.duplicate_of is null
     order by im.url, n.distance_m
  ) s
  order by s.distance_m, s.image_url
  limit in_limit
$$;

-- 5. old-maps: map pages that show a nearby place.
create function public.button_old_maps(
  in_lat double precision, in_lng double precision, in_radius_m integer, in_limit integer default 50)
returns table (place_id text, place_name text, distance_m double precision, source_url text,
               title text, summary text)
language sql stable security invoker set search_path = ''
as $$
  select * from (
    select distinct on (pg.source_url) n.place_id, n.place_name, n.distance_m, pg.source_url, pg.title, pg.summary
      from public.near_places(in_lat, in_lng, in_radius_m) n
      join public.page_places pp on pp.place_id = n.place_id
      join public.pages pg on pg.source_url = pp.page_url and pg.duplicate_of is null
     where pg.page_type = 'map'
     order by pg.source_url, n.distance_m
  ) s
  order by s.distance_m, s.source_url
  limit in_limit
$$;

-- 6. what-was-here: what nearby places used to be, with years.
create function public.button_what_was_here(
  in_lat double precision, in_lng double precision, in_radius_m integer, in_limit integer default 50)
returns table (place_id text, place_name text, distance_m double precision, use text,
               start_year integer, end_year integer, source_url text, page_title text)
language sql stable security invoker set search_path = ''
as $$
  select n.place_id, n.place_name, n.distance_m, u.use, u.start_year, u.end_year, pg.source_url, pg.title
    from public.near_places(in_lat, in_lng, in_radius_m) n
    join public.place_uses u on u.place_id = n.place_id
    join public.pages pg on pg.source_url = u.page_url and pg.duplicate_of is null
   order by n.distance_m, n.place_id, u.start_year nulls last, u.use
   limit in_limit
$$;

-- 7. who-worked-here: people who ran or worked at nearby places, and what the places were used for.
-- `person_name` and `relation` are set for people, `use` for uses; the other columns are null.
create function public.button_who_worked_here(
  in_lat double precision, in_lng double precision, in_radius_m integer, in_limit integer default 50)
returns table (place_id text, place_name text, distance_m double precision, person_name text,
               relation text, use text, start_year integer, end_year integer, source_url text, page_title text)
language sql stable security invoker set search_path = ''
as $$
  select * from (
    select n.place_id, n.place_name, n.distance_m, r.person_name, r.relation, null::text as use,
           r.start_year, r.end_year, pg.source_url, pg.title
      from public.near_places(in_lat, in_lng, in_radius_m) n
      join public.person_place_relations r on r.place_id = n.place_id and r.relation in ('ran', 'worked')
      join public.pages pg on pg.source_url = r.page_url and pg.duplicate_of is null
    union all
    select n.place_id, n.place_name, n.distance_m, null, null, u.use,
           u.start_year, u.end_year, pg.source_url, pg.title
      from public.near_places(in_lat, in_lng, in_radius_m) n
      join public.place_uses u on u.place_id = n.place_id
      join public.pages pg on pg.source_url = u.page_url and pg.duplicate_of is null
  ) s
  order by s.distance_m, s.place_id, s.start_year nulls last, s.person_name nulls last, s.use nulls last
  limit in_limit
$$;

-- 8. why-the-name: where nearby place names come from.
create function public.button_why_the_name(
  in_lat double precision, in_lng double precision, in_radius_m integer, in_limit integer default 50)
returns table (place_id text, place_name text, distance_m double precision, name_origin text,
               source_url text, page_title text)
language sql stable security invoker set search_path = ''
as $$
  select n.place_id, n.place_name, n.distance_m, pp.name_origin, pg.source_url, pg.title
    from public.near_places(in_lat, in_lng, in_radius_m) n
    join public.page_places pp on pp.place_id = n.place_id and pp.name_origin is not null
    join public.pages pg on pg.source_url = pp.page_url and pg.duplicate_of is null
   order by n.distance_m, n.place_id, pg.source_url
   limit in_limit
$$;

-- 9. on-this-day: events at nearby places on a given day and month, any year. The caller passes the
-- date (in Finnish time), so the function does not depend on the server's time zone.
create function public.button_on_this_day(
  in_lat double precision, in_lng double precision, in_radius_m integer,
  in_month integer, in_day integer, in_limit integer default 50)
returns table (place_id text, place_name text, distance_m double precision, event_id text, title text,
               year integer, circa boolean, description text, source_url text, page_title text)
language sql stable security invoker set search_path = ''
as $$
  select * from (
    select distinct on (e.id) n.place_id, n.place_name, n.distance_m, e.id as event_id, e.title, e.year,
           e.circa, e.description, pg.source_url, pg.title as page_title
      from public.near_places(in_lat, in_lng, in_radius_m) n
      join public.event_places ep on ep.place_id = n.place_id
      join public.events e on e.id = ep.event_id and e.month = in_month and e.day = in_day
      join public.pages pg on pg.source_url = e.page_url and pg.duplicate_of is null
     order by e.id, n.distance_m
  ) s
  order by s.year nulls last, s.event_id
  limit in_limit
$$;

-- 10. nearby: other places close by that have pages to read, for walking on.
create function public.button_nearby(
  in_lat double precision, in_lng double precision, in_radius_m integer, in_limit integer default 50)
returns table (place_id text, place_name text, kind text, distance_m double precision, lat double precision,
               lng double precision, page_count integer)
language sql stable security invoker set search_path = ''
as $$
  select n.place_id, n.place_name, n.kind, n.distance_m,
         extensions.st_y(p.location::extensions.geometry), extensions.st_x(p.location::extensions.geometry),
         c.page_count
    from public.near_places(in_lat, in_lng, in_radius_m) n
    join public.places p on p.id = n.place_id
    join lateral (
      select count(*)::integer as page_count
        from public.page_places pp
        join public.pages pg on pg.source_url = pp.page_url and pg.duplicate_of is null
       where pp.place_id = n.place_id) c on c.page_count > 0
   order by n.distance_m, n.place_id
   limit in_limit
$$;

-- Which buttons have at least one result here, and how many (up to in_limit each). A button is only
-- shown when it has results. Ids match the plan (docs/v1-plan.md) and the messages catalog.
create function public.button_counts(
  in_lat double precision, in_lng double precision, in_radius_m integer,
  in_month integer, in_day integer, in_limit integer default 50)
returns table (button_id text, result_count integer)
language sql stable security invoker set search_path = ''
as $$
  select * from (
    select 'who-lived-here' as button_id, count(*)::integer as result_count from public.button_who_lived_here(in_lat, in_lng, in_radius_m, in_limit)
    union all select 'what-happened-here', count(*)::integer from public.button_what_happened_here(in_lat, in_lng, in_radius_m, in_limit)
    union all select 'stories-from-here', count(*)::integer from public.button_stories_from_here(in_lat, in_lng, in_radius_m, in_limit)
    union all select 'old-images-from-here', count(*)::integer from public.button_old_images_from_here(in_lat, in_lng, in_radius_m, in_limit)
    union all select 'old-maps', count(*)::integer from public.button_old_maps(in_lat, in_lng, in_radius_m, in_limit)
    union all select 'what-was-here', count(*)::integer from public.button_what_was_here(in_lat, in_lng, in_radius_m, in_limit)
    union all select 'who-worked-here', count(*)::integer from public.button_who_worked_here(in_lat, in_lng, in_radius_m, in_limit)
    union all select 'why-the-name', count(*)::integer from public.button_why_the_name(in_lat, in_lng, in_radius_m, in_limit)
    union all select 'on-this-day', count(*)::integer from public.button_on_this_day(in_lat, in_lng, in_radius_m, in_month, in_day, in_limit)
    union all select 'nearby', count(*)::integer from public.button_nearby(in_lat, in_lng, in_radius_m, in_limit)
  ) c
  where c.result_count > 0
$$;

-- Only the API server (service role) calls these.
revoke execute on function
  public.near_places(double precision, double precision, integer),
  public.button_who_lived_here(double precision, double precision, integer, integer),
  public.button_what_happened_here(double precision, double precision, integer, integer),
  public.button_stories_from_here(double precision, double precision, integer, integer),
  public.button_old_images_from_here(double precision, double precision, integer, integer),
  public.button_old_maps(double precision, double precision, integer, integer),
  public.button_what_was_here(double precision, double precision, integer, integer),
  public.button_who_worked_here(double precision, double precision, integer, integer),
  public.button_why_the_name(double precision, double precision, integer, integer),
  public.button_on_this_day(double precision, double precision, integer, integer, integer, integer),
  public.button_nearby(double precision, double precision, integer, integer),
  public.button_counts(double precision, double precision, integer, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function
  public.near_places(double precision, double precision, integer),
  public.button_who_lived_here(double precision, double precision, integer, integer),
  public.button_what_happened_here(double precision, double precision, integer, integer),
  public.button_stories_from_here(double precision, double precision, integer, integer),
  public.button_old_images_from_here(double precision, double precision, integer, integer),
  public.button_old_maps(double precision, double precision, integer, integer),
  public.button_what_was_here(double precision, double precision, integer, integer),
  public.button_who_worked_here(double precision, double precision, integer, integer),
  public.button_why_the_name(double precision, double precision, integer, integer),
  public.button_on_this_day(double precision, double precision, integer, integer, integer, integer),
  public.button_nearby(double precision, double precision, integer, integer),
  public.button_counts(double precision, double precision, integer, integer, integer, integer)
  to service_role;
