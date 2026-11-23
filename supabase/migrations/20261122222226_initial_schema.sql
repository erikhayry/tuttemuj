-- Phase 2 (#3): first database schema.
--
-- Mirrors the Zod schemas in packages/schema (PageExtraction, PlaceEntity, PageGroup).
-- git `data/` stays the source of truth; the sync job fills these tables and can rebuild them.
-- The tables hold only derived facts, our own summaries and source URLs. Never page text.

create extension if not exists postgis with schema extensions;
create extension if not exists vector with schema extensions;

-- One row per analysed page (data/pages). The source URL is the stable id.
create table public.pages (
  source_url         text primary key
                       check (source_url like 'https://www.nykarlebyvyer.nu/%'),
  title              text not null,
  -- Short summary in our own words (Swedish).
  summary            text not null,
  topics             text[] not null default '{}',
  -- Pages that repeat each other point at the page to use (data/entities/page-groups.json).
  duplicate_of       text references public.pages (source_url) on delete set null,
  comic_candidate    jsonb,
  content_hash       text not null,
  extraction_version integer not null check (extraction_version > 0),
  model              text not null,
  extracted_at       timestamptz not null
);

create index pages_duplicate_of_idx on public.pages (duplicate_of);

-- One row per real place (data/entities/places.json). The id is a slug of the canonical name.
create table public.places (
  id               text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name             text not null,
  kind             text not null check (kind in (
                     'street', 'building', 'farm', 'district', 'landmark',
                     'waterbody', 'island', 'village', 'other', 'address')),
  aliases          text[] not null default '{}',
  -- Gazetteer entries this place is built from; empty for places that only exist on pages.
  gazetteer_names  text[] not null default '{}',
  -- WGS84 point (lng, lat). Null until the place has been located.
  location         extensions.geography(Point, 4326)
);

create index places_location_idx on public.places using gist (location);
create index places_aliases_idx on public.places using gin (aliases);

-- Which pages mention which places.
create table public.page_places (
  page_url  text not null references public.pages (source_url) on delete cascade,
  place_id  text not null references public.places (id) on delete cascade,
  primary key (page_url, place_id)
);

create index page_places_place_idx on public.page_places (place_id);

-- Lock the tables down. Without policies, only the service role (the sync job and the API server)
-- can read or write them. Public read policies are added when an endpoint needs them.
alter table public.pages enable row level security;
alter table public.places enable row level security;
alter table public.page_places enable row level security;
