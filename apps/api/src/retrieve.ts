import type { SupabaseClient } from "@supabase/supabase-js";
import { embed } from "@tuttemuj/embeddings";
import type { AskRequest } from "@tuttemuj/schema";
import { z } from "zod";
import type { Retrieve } from "./ask.ts";
import type { Fact } from "./facts.ts";
import { NearbyRow } from "./nearby.ts";
import { findPlaceIds, nameBonus, placeNameLoader } from "./place-names.ts";

/** Walking distance for "what is around me", in metres. */
const NEARBY_RADIUS_M = 250;
/** Comic pitches are not answers, so some hits are dropped; ask for extra to make up for it. */
const VECTOR_HITS = 40;
/** Most pages looked up for the places a question names. */
const MAX_NAMED_PAGES = 200;
const MAX_PAGES = 8;
const MAX_EVENTS_PER_PAGE = 3;
/** Added to a page's similarity when it is at the user's location (less the further away it is). */
const PROXIMITY_BONUS = 0.1;

const Hit = z.object({
  kind: z.enum(["page", "event", "comic"]),
  ref: z.string(),
  page_url: z.string(),
  distance: z.number(),
});
const Similarity = z.object({ page_url: z.string(), distance: z.number() });
const PageRow = z.object({ source_url: z.string(), title: z.string(), summary: z.string() });
const EventRow = z.object({
  id: z.string(),
  page_url: z.string(),
  title: z.string(),
  year: z.int().nullable(),
  description: z.string().nullable(),
});

const PersonRow = z.object({
  page_url: z.string(),
  name: z.string(),
  birth_year: z.int().nullable(),
  death_year: z.int().nullable(),
  roles: z.array(z.string()),
});

/** The most people shown per page, those with a role or years first. */
const MAX_PEOPLE_PER_PAGE = 8;

/** "Name (1850–1920, role, role)": only what the page states. */
export function personLabel(
  p: Pick<z.infer<typeof PersonRow>, "name" | "birth_year" | "death_year" | "roles">,
): string {
  const years =
    p.birth_year !== null && p.death_year !== null
      ? `${p.birth_year}–${p.death_year}`
      : p.birth_year !== null
        ? `född ${p.birth_year}`
        : p.death_year !== null
          ? `död ${p.death_year}`
          : "";
  const details = [years, ...p.roles].filter(Boolean).join(", ");
  return details ? `${p.name} (${details})` : p.name;
}

const check = <T>(
  what: string,
  schema: z.ZodType<T>,
  data: unknown,
  error: { message: string } | null,
): T => {
  if (error) throw new Error(`${what}: ${error.message}`);
  return schema.parse(data);
};

type Candidate = { score: number; eventIds: string[] };

/**
 * Find the facts for a question: pages whose meaning is close to it (vector search) plus the
 * pages about places around the user and the places the question names, ranked by similarity with
 * a bonus for being nearby or about a named place. Comic pitches are left out.
 * Returns our summaries and event descriptions only, never page text.
 */
export function supabaseRetrieve(
  db: SupabaseClient,
  voyageKey: string,
  embedQuestion: typeof embed = embed,
): Retrieve {
  const placeNames = placeNameLoader(db);
  return async (req: AskRequest) => {
    const { vectors } = await embedQuestion(voyageKey, [req.question], "query");
    const vector = JSON.stringify(vectors[0]);

    const located = req.lat !== undefined && req.lng !== undefined;
    const [searched, around] = await Promise.all([
      db.rpc("search_embeddings", { in_embedding: vector, in_limit: VECTOR_HITS }),
      located
        ? db.rpc("nearby_places", {
            in_lat: req.lat,
            in_lng: req.lng,
            in_radius_m: NEARBY_RADIUS_M,
            in_max_places: 15,
            in_max_pages: 8,
            in_max_events: 0,
          })
        : Promise.resolve({ data: [], error: null }),
    ]);
    const hits = check("search_embeddings", z.array(Hit), searched.data, searched.error).filter(
      (h) => h.kind !== "comic",
    );
    const places = check("nearby_places", z.array(NearbyRow), around.data, around.error);

    // Distance to the closest place that mentions each page.
    const closeness = new Map<string, number>();
    for (const p of places) {
      for (const page of p.pages) {
        closeness.set(
          page.sourceUrl,
          Math.min(closeness.get(page.sourceUrl) ?? Infinity, p.distance_m),
        );
      }
    }

    // Pages that mention a place the question names, with the bonus each earns. A name in the
    // question is a stronger signal than similar-sounding words (Forsby vs the surname Fors).
    const named = new Map<string, number>();
    const namedIds = findPlaceIds(req.question, await placeNames());
    if (namedIds.length > 0) {
      const { data, error } = await db
        .from("page_places")
        .select("page_url,place_id")
        .in("place_id", namedIds)
        .limit(1000);
      const links = check(
        "page_places",
        z.array(z.object({ page_url: z.string(), place_id: z.string() })),
        data,
        error,
      );
      const perPlace = new Map<string, number>();
      for (const l of links) perPlace.set(l.place_id, (perPlace.get(l.place_id) ?? 0) + 1);
      for (const l of links) {
        const bonus = nameBonus(perPlace.get(l.place_id) ?? 1);
        named.set(l.page_url, Math.max(named.get(l.page_url) ?? 0, bonus));
      }
    }

    const candidates = new Map<string, Candidate>();
    for (const h of hits) {
      const c = candidates.get(h.page_url) ?? { score: -Infinity, eventIds: [] };
      c.score = Math.max(c.score, 1 - h.distance);
      if (h.kind === "event") c.eventIds.push(h.ref);
      candidates.set(h.page_url, c);
    }

    // How close in meaning are the pages at the user's location or about a named place, when the
    // search did not find them?
    const unseen = [
      ...new Set([...closeness.keys(), ...[...named.keys()].slice(0, MAX_NAMED_PAGES)]),
    ].filter((url) => !candidates.has(url));
    if (unseen.length > 0) {
      const { data, error } = await db.rpc("page_similarity", {
        in_embedding: vector,
        in_pages: unseen,
      });
      for (const s of check("page_similarity", z.array(Similarity), data, error)) {
        candidates.set(s.page_url, { score: 1 - s.distance, eventIds: [] });
      }
    }

    const ranked = [...candidates.entries()]
      .map(([url, c]) => {
        const d = closeness.get(url);
        const bonus = d === undefined ? 0 : PROXIMITY_BONUS * Math.max(0, 1 - d / NEARBY_RADIUS_M);
        return { url, ...c, score: c.score + bonus + (named.get(url) ?? 0) };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_PAGES);
    if (ranked.length === 0) return { facts: [], nearby: undefined };

    const eventIds = ranked.flatMap((r) => r.eventIds.slice(0, MAX_EVENTS_PER_PAGE));
    const [pageRes, eventRes, peopleRes] = await Promise.all([
      db
        .from("pages")
        .select("source_url,title,summary")
        .in(
          "source_url",
          ranked.map((r) => r.url),
        ),
      eventIds.length > 0
        ? db.from("events").select("id,page_url,title,year,description").in("id", eventIds)
        : Promise.resolve({ data: [], error: null }),
      db
        .from("page_people")
        .select("page_url,name,birth_year,death_year,roles")
        .in(
          "page_url",
          ranked.map((r) => r.url),
        )
        .limit(1000),
    ]);
    const people = check("page_people", z.array(PersonRow), peopleRes.data, peopleRes.error);
    const pages = new Map(
      check("pages", z.array(PageRow), pageRes.data, pageRes.error).map((p) => [p.source_url, p]),
    );
    const events = check("events", z.array(EventRow), eventRes.data, eventRes.error);

    const facts: Fact[] = [];
    for (const r of ranked) {
      const page = pages.get(r.url);
      if (!page) continue;
      const lines = [page.summary];
      for (const e of events.filter((ev) => ev.page_url === r.url)) {
        lines.push(
          `${e.year !== null ? `${e.year}: ` : ""}${e.title}${e.description ? `. ${e.description}` : ""}`,
        );
      }
      const onPage = people
        .filter((p) => p.page_url === r.url)
        .sort(
          (a, b) =>
            Number(b.roles.length > 0 || b.birth_year !== null || b.death_year !== null) -
            Number(a.roles.length > 0 || a.birth_year !== null || a.death_year !== null),
        )
        .slice(0, MAX_PEOPLE_PER_PAGE)
        .map(personLabel);
      if (onPage.length > 0) lines.push(`People: ${onPage.join("; ")}`);
      facts.push({
        sourceUrl: r.url,
        pageTitle: page.title,
        summary: page.summary,
        people: onPage,
        lines,
      });
    }

    const nearby = places
      .slice(0, 3)
      .map((p) => ({ place: p.name, distanceM: Math.round(p.distance_m) }));
    return { facts, nearby: nearby.length > 0 ? nearby : undefined };
  };
}
