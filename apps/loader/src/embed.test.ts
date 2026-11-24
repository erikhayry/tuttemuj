import { describe, expect, it } from "vitest";
import { embedItems, hashOf, isNavigationPage } from "./embed-items.ts";
import { plan } from "./embed-sync.ts";
import type { EventRow, PageRow } from "./rows.ts";

const u = (n: string) => `https://www.nykarlebyvyer.nu/sidor/${n}.html`;

const page = (n: string, extra: Partial<PageRow> = {}): PageRow => ({
  source_url: u(n),
  title: `Titel ${n}`,
  summary: `Sammanfattning ${n}`,
  topics: [],
  duplicate_of: null,
  comic_candidate: null,
  page_type: null,
  content_hash: "h",
  extraction_version: 1,
  model: "m",
  extracted_at: "2026-11-01T10:00:00.000Z",
  ...extra,
});

const event = (n: string, i: number, extra: Partial<EventRow> = {}): EventRow => ({
  id: `${u(n)}#${i}`,
  page_url: u(n),
  title: "Bron byggs",
  year: 1890,
  month: null,
  day: null,
  end_year: null,
  circa: true,
  description: "Tar två år.",
  people: [],
  ...extra,
});

describe("embedItems", () => {
  const items = embedItems({
    pages: [
      page("a", { comic_candidate: { pitch: "En berättelse.", reason: "r" } }),
      page("b", { duplicate_of: u("a") }),
    ],
    events: [event("a", 0), event("b", 0), event("a", 1, { year: null, description: null })],
  });

  it("embeds a page summary, a comic pitch and events with their page title and year", () => {
    expect(items.map((i) => [i.kind, i.ref])).toEqual([
      ["page", u("a")],
      ["comic", u("a")],
      ["event", `${u("a")}#0`],
      ["event", `${u("a")}#1`],
    ]);
    expect(items[0]?.text).toBe("Titel a\nSammanfattning a");
    expect(items[1]?.text).toBe("Titel a\nEn berättelse.");
    expect(items[2]?.text).toBe("Titel a: Bron byggs (ca 1890). Tar två år.");
    expect(items[3]?.text).toBe("Titel a: Bron byggs");
  });

  it("skips duplicate pages and their events", () => {
    expect(items.some((i) => i.pageUrl === u("b"))).toBe(false);
  });
});

describe("plan", () => {
  const items = embedItems({ pages: [page("a"), page("c")], events: [] });
  const existing = [
    { kind: "page", ref: u("a"), text_hash: hashOf("Titel a\nSammanfattning a") },
    { kind: "page", ref: u("old"), text_hash: "x" },
  ];

  it("embeds what is new, keeps what is unchanged and drops what is gone", () => {
    const { todo, stale } = plan(items, existing);
    expect(todo.map((i) => i.ref)).toEqual([u("c")]);
    expect(stale.map((s) => s.ref)).toEqual([u("old")]);
  });

  it("embeds again when the text changed", () => {
    const { todo } = plan(items, [{ kind: "page", ref: u("a"), text_hash: "different" }]);
    expect(todo.map((i) => i.ref)).toEqual([u("a"), u("c")]);
  });
});

describe("isNavigationPage", () => {
  const empty = { people: [], places: [], events: [] };

  it.each([
    "Nästan tom sida med bara texten Meny1.",
    "Ramsida för avsnittet om hädangångna hus.",
    "En innehållsförteckning över tjära i Nykarleby.",
    "Faktasidan för Karhumäki-kort 4253. Sidan har ingen egen text utöver rubriken.",
  ])("skips %s", (summary) => {
    expect(isNavigationPage({ ...empty, summary })).toBe(true);
  });

  it("keeps a postcard with little text", () => {
    expect(
      isNavigationPage({ ...empty, summary: "Ett kort från Nykarleby 1905 med en stämpel." }),
    ).toBe(false);
  });

  it("keeps a page with facts even when its summary mentions a menu", () => {
    const places = [{ name: "Torget", kind: "district" as const, alternateNames: [] }];
    expect(isNavigationPage({ ...empty, places, summary: "Meny över torget." })).toBe(false);
  });
});

describe("embedItems skip", () => {
  it("leaves out skipped pages and their events", () => {
    const items = embedItems(
      { pages: [page("a"), page("b")], events: [event("a", 0), event("b", 0)] },
      new Set([u("a")]),
    );
    expect(items.every((i) => i.pageUrl === u("b"))).toBe(true);
  });
});
