-- v1 (#48, #56): what the nine location buttons need besides coordinates.
--
-- Mirrors the v1 fields in packages/schema (#53): pageType, relations, images, and on each place
-- `uses` and `nameOrigin`. Only derived facts and our own short words, never page text. A missing
-- page_type means "not assessed yet" (the page has not been enriched or extracted with v2).
--
-- Additive only: one column on pages, one on page_places, four new tables. Nothing is dropped or
-- rewritten, and every statement can be rolled back by dropping what it adds.

alter table public.pages
  add column page_type text
    check (page_type in ('empty', 'photo', 'postcard', 'map', 'story', 'article', 'list', 'menu'));

-- "Vad fanns här förr?": where the name of a place comes from, in our own words. Per page,
-- because two pages may explain the same place's name differently.
alter table public.page_places
  add column name_origin text;

-- "Vad fanns här förr?" and "Vem arbetade här?": what a place was used for, as one page says it.
create table public.place_uses (
  -- "<source url>#<n>": the n-th use on that page.
  id          text primary key,
  page_url    text not null references public.pages (source_url) on delete cascade,
  place_id    text not null references public.places (id) on delete cascade,
  -- Short lowercase Swedish noun, e.g. "apotek".
  use         text not null,
  -- Only when the page states them.
  start_year  integer,
  end_year    integer check (end_year is null or start_year is null or end_year >= start_year)
);

create index place_uses_place_idx on public.place_uses (place_id);
create index place_uses_page_idx on public.place_uses (page_url);

-- "Vem bodde här?" and "Vem arbetade här?": how a person on a page is tied to a place on it.
-- People are not merged across pages, so the person is a (page, name) pair, like page_people.
create table public.person_place_relations (
  -- "<source url>#<n>": the n-th relation on that page.
  id           text primary key,
  page_url     text not null,
  person_name  text not null,
  place_id     text not null references public.places (id) on delete cascade,
  relation     text not null check (relation in ('lived', 'owned', 'built', 'ran', 'worked', 'born', 'died')),
  start_year   integer,
  end_year     integer check (end_year is null or start_year is null or end_year >= start_year),
  foreign key (page_url, person_name) references public.page_people (page_url, name) on delete cascade
);

create index person_place_relations_place_idx on public.person_place_relations (place_id);
create index person_place_relations_page_idx on public.person_place_relations (page_url);

-- "Visa gamla bilder härifrån": what the page says one of its large images shows.
-- image_number is the n in the extraction text's [bild n]; the image itself is never stored. Which
-- images are photos worth showing comes from data/images.jsonl (Jev), not from here.
create table public.image_facts (
  -- "<source url>#bild<n>"
  id            text primary key,
  page_url      text not null references public.pages (source_url) on delete cascade,
  image_number  integer not null check (image_number > 0),
  -- The year the image was made or shows, when the page states it.
  year          integer,
  unique (page_url, image_number)
);

create index image_facts_page_idx on public.image_facts (page_url);

create table public.image_fact_places (
  image_id  text not null references public.image_facts (id) on delete cascade,
  place_id  text not null references public.places (id) on delete cascade,
  primary key (image_id, place_id)
);

create index image_fact_places_place_idx on public.image_fact_places (place_id);

-- Same as the other tables: no public access. The API reads with its own key.
alter table public.place_uses enable row level security;
alter table public.person_place_relations enable row level security;
alter table public.image_facts enable row level security;
alter table public.image_fact_places enable row level security;
