import type {
  GazetteerEntry,
  GazetteerKind,
  GeoPoint,
  PageExtraction,
  PlaceEntity,
  PlaceMerge,
  PlaceReview,
} from "@tuttemuj/schema";
import { normalizeName } from "../gazetteer/build.ts";

const STREETLIKE = new Set<string>(["street", "address"]);

export const slugify = (name: string): string =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "place";

const namesOf = (e: GazetteerEntry): string[] =>
  [e.name, ...(e.alternateNames ?? [])].map(normalizeName);

const pointKey = (p: GeoPoint): string => `${p.lat},${p.lng}`;
const bySv = (a: string, b: string): number => a.localeCompare(b, "sv");

type Group = {
  entries: GazetteerEntry[];
  pages: Set<string>;
  seenNames: Set<string>;
};

type Resolved = { entities: PlaceEntity[]; review: PlaceReview[] };

/**
 * Merge page mentions and gazetteer entries into canonical places.
 *
 * Merges only on evidence: a gazetteer entry that lists another entry's name as an alternate,
 * or a hand-confirmed entry in `merges`. Suspicious cases are reported in `review`, not merged.
 * Only places mentioned on at least one page are returned.
 */
export function resolvePlaces(
  entries: GazetteerEntry[],
  pages: Pick<PageExtraction, "sourceUrl" | "places">[],
  merges: readonly PlaceMerge[] = [],
): Resolved {
  // Union-find over gazetteer entries.
  const parent = entries.map((_, i) => i);
  const find = (i: number): number => {
    let r = i;
    while (parent[r] !== r) r = parent[r] as number;
    parent[i] = r;
    return r;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  };

  const byName = new Map<string, number[]>();
  const own = new Map<string, number>();
  entries.forEach((e, i) => {
    own.set(normalizeName(e.name), i);
    for (const n of namesOf(e)) byName.set(n, [...(byName.get(n) ?? []), i]);
  });

  entries.forEach((e, i) => {
    for (const n of namesOf(e)) {
      const j = own.get(n);
      if (j !== undefined) union(i, j);
    }
  });
  for (const merge of merges) {
    const idx = merge.names.map((n) => {
      const j = own.get(normalizeName(n));
      if (j === undefined) throw new Error(`place-merges: "${n}" is not a gazetteer name`);
      return j;
    });
    for (const j of idx.slice(1)) union(idx[0] as number, j);
  }

  const groups = new Map<number, Group>();
  const group = (root: number): Group => {
    let g = groups.get(root);
    if (!g) {
      g = { entries: [], pages: new Set(), seenNames: new Set() };
      groups.set(root, g);
    }
    return g;
  };
  entries.forEach((e, i) => {
    group(find(i)).entries.push(e);
  });

  // Mentions that match no gazetteer entry, grouped by normalised name.
  const unmatched = new Map<
    string,
    { kind: GazetteerKind; pages: Set<string>; aliases: Set<string> }
  >();
  const entryPages = new Map<GazetteerEntry, Set<string>>();
  const ambiguous: { roots: number[]; url: string; name: string }[] = [];

  for (const page of pages) {
    for (const place of page.places) {
      const names = [place.name, ...place.alternateNames].map(normalizeName);
      const hitRoots = new Map<number, string>(); // root -> first matching name
      for (const n of names) {
        for (const i of byName.get(n) ?? []) {
          const e = entries[i] as GazetteerEntry;
          // A street name only matches a place that is itself a street.
          if (STREETLIKE.has(e.kind) && place.kind !== "street") continue;
          if (!hitRoots.has(find(i))) hitRoots.set(find(i), n);
          const set = entryPages.get(e) ?? new Set<string>();
          set.add(page.sourceUrl);
          entryPages.set(e, set);
        }
      }
      if (hitRoots.size === 0 && place.address) {
        for (const i of byName.get(normalizeName(place.address)) ?? [])
          hitRoots.set(find(i), place.address);
      }
      if (hitRoots.size === 0) {
        const key = normalizeName(place.name);
        const u = unmatched.get(key) ?? {
          kind: place.kind,
          pages: new Set<string>(),
          aliases: new Set<string>(),
        };
        u.pages.add(page.sourceUrl);
        for (const a of names) if (a !== key) u.aliases.add(a);
        unmatched.set(key, u);
        continue;
      }
      const roots = [...hitRoots.keys()];
      // The page mentions every place the mention's names point at.
      for (const r of roots) {
        const g = group(r);
        g.pages.add(page.sourceUrl);
        for (const n of names) if (roots.length === 1) g.seenNames.add(n);
      }
      if (roots.length > 1) ambiguous.push({ roots, url: page.sourceUrl, name: place.name });
    }
  }

  type Draft = Omit<PlaceEntity, "id"> & { root?: number };
  const drafts: Draft[] = [];
  for (const [root, g] of groups) {
    if (g.pages.size === 0) continue;
    const all = new Set(g.entries.flatMap(namesOf));
    // Canonical: the entry listing the most of the group's other names, then the one most pages
    // mention, then a located one, then by name.
    const score = (e: GazetteerEntry) =>
      (e.alternateNames ?? []).filter((a) => all.has(normalizeName(a))).length;
    const sorted = [...g.entries].sort(
      (a, b) =>
        score(b) - score(a) ||
        (entryPages.get(b)?.size ?? 0) - (entryPages.get(a)?.size ?? 0) ||
        Number(!!b.location) - Number(!!a.location) ||
        bySv(a.name, b.name),
    );
    const canon = sorted[0] as GazetteerEntry;
    const location = canon.location ?? sorted.find((e) => e.location)?.location;
    const aliases = [...new Set([...all, ...g.seenNames])]
      .filter((n) => n !== normalizeName(canon.name))
      .sort(bySv);
    drafts.push({
      name: canon.name,
      kind: canon.kind,
      aliases,
      ...(location ? { location } : {}),
      gazetteerNames: g.entries.map((e) => e.name).sort(bySv),
      pages: [...g.pages].sort(),
      root,
    });
  }
  for (const [name, u] of unmatched) {
    drafts.push({
      name,
      kind: u.kind,
      aliases: [...u.aliases].sort(bySv),
      gazetteerNames: [],
      pages: [...u.pages].sort(),
    });
  }

  // Stable slug ids, suffixed on clashes in name order.
  drafts.sort((a, b) => bySv(a.name, b.name));
  const used = new Map<string, number>();
  const rootToId = new Map<number, string>();
  const entities: PlaceEntity[] = drafts.map(({ root, ...d }) => {
    const base = slugify(d.name);
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    const id = n === 1 ? base : `${base}-${n}`;
    if (root !== undefined) rootToId.set(root, id);
    return { id, ...d };
  });

  const review: PlaceReview[] = [];
  const byPoint = new Map<string, PlaceEntity[]>();
  for (const e of entities) {
    if (!e.location) continue;
    const k = pointKey(e.location);
    byPoint.set(k, [...(byPoint.get(k) ?? []), e]);
  }
  for (const [k, es] of byPoint) {
    if (es.length < 2) continue;
    review.push({
      reason: "same-coordinates",
      ids: es.map((e) => e.id),
      detail: `All at ${k}: ${es.map((e) => e.name).join(", ")}`,
    });
  }
  const seen = new Set<string>();
  for (const a of ambiguous) {
    const ids = [...new Set(a.roots.map((r) => rootToId.get(r)).filter((x): x is string => !!x))];
    const key = ids.sort().join("|");
    if (ids.length < 2 || seen.has(key)) continue;
    seen.add(key);
    review.push({
      reason: "mention-matches-several",
      ids,
      detail: `"${a.name}" on ${a.url} matches ${ids.join(", ")}`,
    });
  }
  return { entities, review };
}
