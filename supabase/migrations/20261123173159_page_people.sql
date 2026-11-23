-- Phase 2 (#3): the people each page mentions, for answers to "who" questions.
--
-- Mirrors PersonMention in packages/schema: one row per person per page, as the page names them.
-- People are not merged across pages yet (two "Johan Fors" may be different people), so there is
-- no people entity table. Holds names, years, roles and our own short descriptions, never page
-- text.

create table public.page_people (
  page_url         text not null references public.pages (source_url) on delete cascade,
  -- As written on the page (PersonMention.name).
  name             text not null,
  alternate_names  text[] not null default '{}',
  -- Only when the page states them.
  birth_year       integer,
  death_year       integer,
  roles            text[] not null default '{}',
  description      text,
  primary key (page_url, name)
);

create index page_people_name_idx on public.page_people (lower(name));

alter table public.page_people enable row level security;
