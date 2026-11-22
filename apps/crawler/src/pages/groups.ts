import type { DuplicateEvidence, PageGroup } from "@tuttemuj/schema";
import { SOURCE_ORIGIN } from "@tuttemuj/schema";

export type PageInfo = {
  /** Path on the site without a leading slash, e.g. "sidor/karta/kyrkan.htm". */
  path: string;
  /** Known only for analysed pages. */
  title?: string | undefined;
  /** Every image URL on the page, including enlargements. */
  images: string[];
  /** Number of extracted people, places and events. */
  facts: number;
};

const split = (path: string) => {
  const i = path.lastIndexOf("/");
  const file = path.slice(i + 1);
  const dot = file.lastIndexOf(".");
  return {
    dir: path.slice(0, i + 1).toLowerCase(),
    stem: (dot < 0 ? file : file.slice(0, dot)).toLowerCase(),
    ext: dot < 0 ? "" : file.slice(dot).toLowerCase(),
  };
};

const imageKey = (p: PageInfo): string => [...new Set(p.images)].sort().join("\n");
const norm = (t: string): string => t.trim().toLowerCase().replace(/\s+/g, " ");

const similarTitle = (a?: string, b?: string): boolean => {
  if (!a || !b) return false;
  const [x, y] = [norm(a), norm(b)];
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return long.startsWith(`${short} – `) || long.startsWith(`${short} (`);
};

const isEnglishSection = (p: PageInfo): boolean => p.path.toLowerCase().includes("/english/");

/**
 * Find pages that repeat each other. Conservative: a pair needs a similar filename and exactly the
 * same images, so two pages that merely show the same photo, or share a title, stay separate.
 */
export function groupDuplicatePages(pages: PageInfo[]): PageGroup[] {
  const parent = pages.map((_, i) => i);
  const find = (i: number): number => {
    let r = i;
    while (parent[r] !== r) r = parent[r] as number;
    parent[i] = r;
    return r;
  };
  const evidence = new Map<number, Set<DuplicateEvidence>>(); // page index -> evidence for its link
  const link = (a: number, b: number, why: DuplicateEvidence[]) => {
    for (const i of [a, b]) {
      const set = evidence.get(i) ?? new Set<DuplicateEvidence>();
      for (const w of why) set.add(w);
      evidence.set(i, set);
    }
    const [ra, rb] = [find(a), find(b)];
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  };

  const parts = pages.map((p) => split(p.path));
  const keys = pages.map(imageKey);

  // Same folder, filenames differing only in the last character.
  const bySibling = new Map<string, number[]>();
  parts.forEach((p, i) => {
    if (p.stem.length < 3) return;
    const k = `${p.dir}|${p.stem.slice(0, -1)}|${p.ext}`;
    bySibling.set(k, [...(bySibling.get(k) ?? []), i]);
  });
  for (const idx of bySibling.values()) {
    for (let x = 0; x < idx.length; x++) {
      for (let y = x + 1; y < idx.length; y++) {
        const [a, b] = [idx[x] as number, idx[y] as number];
        // Matching filenames alone, or a matching title alone, is not enough: sequence pages such as
        // "part 1" and "part 2" share a title. The pages must also show exactly the same images.
        if (!keys[a] || keys[a] !== keys[b]) continue;
        const why: DuplicateEvidence[] = ["similar-filename", "same-images"];
        if (similarTitle(pages[a]?.title, pages[b]?.title)) why.push("same-title");
        link(a, b, why);
      }
    }
  }

  // An English-section page with the same images as Swedish pages that already form one group.
  const byImages = new Map<string, number[]>();
  keys.forEach((k, i) => {
    if (k) byImages.set(k, [...(byImages.get(k) ?? []), i]);
  });
  pages.forEach((p, i) => {
    if (!isEnglishSection(p) || !keys[i]) return;
    const others = (byImages.get(keys[i] as string) ?? []).filter(
      (j) => j !== i && !isEnglishSection(pages[j] as PageInfo),
    );
    if (others.length === 0 || new Set(others.map(find)).size > 1) return;
    link(i, others[0] as number, ["english-section", "same-images"]);
  });

  const members = new Map<number, number[]>();
  pages.forEach((_, i) => {
    members.set(find(i), [...(members.get(find(i)) ?? []), i]);
  });

  const url = (i: number) => `${SOURCE_ORIGIN}/${(pages[i] as PageInfo).path}`;
  const groups: PageGroup[] = [];
  for (const idx of members.values()) {
    if (idx.length < 2) continue;
    // A page ending in "e" next to siblings that do not is the English caption page.
    const english = (i: number) => {
      const p = pages[i] as PageInfo;
      if (isEnglishSection(p) || /engelsk bildtext/i.test(p.title ?? "")) return true;
      const stem = (parts[i] as ReturnType<typeof split>).stem;
      return (
        stem.endsWith("e") &&
        idx.some((j) => j !== i && !(parts[j] as ReturnType<typeof split>).stem.endsWith("e"))
      );
    };
    const ranked = [...idx].sort(
      (a, b) =>
        Number(english(a)) - Number(english(b)) ||
        (pages[b] as PageInfo).facts - (pages[a] as PageInfo).facts ||
        (pages[a] as PageInfo).path.localeCompare((pages[b] as PageInfo).path),
    );
    const [primary, ...rest] = ranked as [number, ...number[]];
    groups.push({
      primary: url(primary) as PageGroup["primary"],
      duplicates: rest.map((i) => ({
        url: url(i) as PageGroup["primary"],
        kind: english(i) ? ("english" as const) : ("variant" as const),
        evidence: [...(evidence.get(i) ?? [])],
      })),
    });
  }
  return groups.sort((a, b) => a.primary.localeCompare(b.primary));
}
