import { describe, expect, it } from "vitest";
import { groupDuplicatePages, type PageInfo } from "./groups.ts";

const page = (path: string, images: string[], title?: string, facts = 0): PageInfo => ({
  path,
  images,
  facts,
  title,
});
const url = (p: string) => `https://www.nykarlebyvyer.nu/${p}`;

describe("groupDuplicatePages", () => {
  it("groups a Swedish page with its English caption twin and keeps the Swedish as primary", () => {
    const groups = groupDuplicatePages([
      page("sidor/karta/kyrkae.htm", ["a.jpg"], "Kyrkan – Sankta Birgitta kyrka", 5),
      page("sidor/karta/kyrkan.htm", ["a.jpg"], "Kyrkan", 1),
    ]);
    expect(groups).toEqual([
      {
        primary: url("sidor/karta/kyrkan.htm"),
        duplicates: [
          {
            url: url("sidor/karta/kyrkae.htm"),
            kind: "english",
            evidence: ["similar-filename", "same-images", "same-title"],
          },
        ],
      },
    ]);
  });

  it("treats same-image size variants as variants and prefers the page with more facts", () => {
    const [g] = groupDuplicatePages([
      page("sidor/kortindi/VB/vbar019j.htm", ["x.jpg"], "Vy", 1),
      page("sidor/kortindi/VB/VBAR019S.HTM", ["x.jpg"], "Vy 1902", 3),
    ]);
    expect(g?.primary).toBe(url("sidor/kortindi/VB/VBAR019S.HTM"));
    expect(g?.duplicates[0]?.kind).toBe("variant");
  });

  it("does not group sequence pages that only share a title", () => {
    expect(
      groupDuplicatePages([
        page("sidor/texter/andrasjon1.html", ["a.jpg"], "Andra sjöns historia"),
        page("sidor/texter/andrasjon2.html", ["b.jpg"], "Andra sjöns historia"),
        page("sidor/texter/andrasjon3.html", [], "Andra sjöns historia"),
      ]),
    ).toEqual([]);
  });

  it("does not group pages that merely share a photo across folders", () => {
    expect(
      groupDuplicatePages([
        page("sidor/46/23espen.html", ["p.jpg"]),
        page("sidor/texter/prosa/parkesp13.html", ["p.jpg"]),
      ]),
    ).toEqual([]);
  });

  it("links an English-section page to the Swedish page with the same images", () => {
    const [g] = groupDuplicatePages([
      page("sidor/english/e_finla.htm", ["f.jpg"]),
      page("sidor/nykarleb/finland.htm", ["f.jpg"]),
    ]);
    expect(g?.primary).toBe(url("sidor/nykarleb/finland.htm"));
    expect(g?.duplicates[0]).toMatchObject({
      kind: "english",
      evidence: ["english-section", "same-images"],
    });
  });

  it("skips an English page whose images match unrelated Swedish pages", () => {
    expect(
      groupDuplicatePages([
        page("sidor/english/e_lito.htm", ["i.jpg"]),
        page("sidor/nykarleb/a.htm", ["i.jpg"]),
        page("sidor/other/b.htm", ["i.jpg"]),
      ]),
    ).toEqual([]);
  });
});
