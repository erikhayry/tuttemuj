import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Rows } from "./rows.ts";

const BATCH = 500;

const chunks = <T>(items: readonly T[], size = BATCH): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

const fail = (what: string, error: { message: string } | null) => {
  if (error) throw new Error(`${what}: ${error.message}`);
};

/** Every value of `column`, read a page at a time (the API returns at most 1000 rows). */
export async function readAll(db: SupabaseClient, table: string, columns: string) {
  const rows: Record<string, string>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from(table)
      .select(columns)
      .order(columns.split(",")[0] as string)
      .order(columns.split(",").at(-1) as string)
      .range(from, from + 999);
    fail(`read ${table}`, error);
    const page = (data ?? []) as unknown as Record<string, string>[];
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

export type SyncResult = { upserted: Record<string, number>; removed: Record<string, number> };

/**
 * Make the database match `rows`. Safe to run again: rows are upserted by key, and rows that are no
 * longer in `data/` are removed (git is the source of truth).
 */
export async function syncRows(url: string, key: string, rows: Rows): Promise<SyncResult> {
  const db = createClient(url, key, { auth: { persistSession: false } });
  const upsert = async (table: string, items: readonly object[], onConflict: string) => {
    for (const part of chunks(items)) {
      const { error } = await db.from(table).upsert(part, { onConflict });
      fail(`upsert ${table}`, error);
    }
  };

  await upsert("places", rows.places, "id");
  // Pages first without their duplicate links, then with them, so a link never points at a page
  // that has not been written yet.
  await upsert(
    "pages",
    rows.pages.map((p) => ({ ...p, duplicate_of: null })),
    "source_url",
  );
  await upsert(
    "pages",
    rows.pages.filter((p) => p.duplicate_of !== null),
    "source_url",
  );

  // Events and the v1 facts after their pages and places, links after both.
  await upsert("events", rows.events, "id");
  await upsert("place_uses", rows.placeUses, "id");
  await upsert("image_facts", rows.imageFacts, "id");

  // Links: remove the ones that are gone, then add the current ones.
  const syncLinks = async (
    table: string,
    a: string,
    b: string,
    links: readonly Record<string, unknown>[],
  ) => {
    const wanted = new Set(links.map((r) => `${r[a]}\n${r[b]}`));
    const existing = await readAll(db, table, `${a},${b}`);
    const stale = existing.filter((r) => !wanted.has(`${r[a]}\n${r[b]}`));
    for (const r of stale) {
      const { error } = await db
        .from(table)
        .delete()
        .eq(a, r[a] as string)
        .eq(b, r[b] as string);
      fail(`delete ${table}`, error);
    }
    await upsert(table, links, `${a},${b}`);
    return stale.length;
  };
  const stalePagePlaces = await syncLinks("page_places", "page_url", "place_id", rows.pagePlaces);
  const staleEventPlaces = await syncLinks(
    "event_places",
    "event_id",
    "place_id",
    rows.eventPlaces,
  );

  const stalePagePeople = await syncLinks("page_people", "page_url", "name", rows.pagePeople);
  // Relations point at (page, person) rows, so they come after page_people.
  await upsert("person_place_relations", rows.relations, "id");
  const staleImagePlaces = await syncLinks(
    "image_fact_places",
    "image_id",
    "place_id",
    rows.imageFactPlaces,
  );

  // Pages and places that no longer exist (their links go with them).
  const removeMissing = async (table: string, column: string, keep: string[]) => {
    const keepSet = new Set(keep);
    const gone = (await readAll(db, table, column))
      .map((r) => r[column] as string)
      .filter((v) => !keepSet.has(v));
    for (const part of chunks(gone, 100)) {
      const { error } = await db.from(table).delete().in(column, part);
      fail(`delete ${table}`, error);
    }
    return gone.length;
  };
  const removedPages = await removeMissing(
    "pages",
    "source_url",
    rows.pages.map((p) => p.source_url),
  );
  const removedEvents = await removeMissing(
    "events",
    "id",
    rows.events.map((e) => e.id),
  );
  const removedUses = await removeMissing(
    "place_uses",
    "id",
    rows.placeUses.map((u) => u.id),
  );
  const removedRelations = await removeMissing(
    "person_place_relations",
    "id",
    rows.relations.map((r) => r.id),
  );
  const removedImages = await removeMissing(
    "image_facts",
    "id",
    rows.imageFacts.map((i) => i.id),
  );
  const removedPlaces = await removeMissing(
    "places",
    "id",
    rows.places.map((p) => p.id),
  );

  return {
    upserted: {
      pages: rows.pages.length,
      places: rows.places.length,
      page_places: rows.pagePlaces.length,
      events: rows.events.length,
      event_places: rows.eventPlaces.length,
      page_people: rows.pagePeople.length,
      place_uses: rows.placeUses.length,
      person_place_relations: rows.relations.length,
      image_facts: rows.imageFacts.length,
      image_fact_places: rows.imageFactPlaces.length,
    },
    removed: {
      pages: removedPages,
      places: removedPlaces,
      events: removedEvents,
      page_places: stalePagePlaces,
      event_places: staleEventPlaces,
      page_people: stalePagePeople,
      place_uses: removedUses,
      person_place_relations: removedRelations,
      image_facts: removedImages,
      image_fact_places: staleImagePlaces,
    },
  };
}
