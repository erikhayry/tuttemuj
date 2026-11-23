import { describe, expect, it } from "vitest";
import { crawlPriority, isCrawlable, normalizeUrl } from "./url.ts";

const page = "https://www.nykarlebyvyer.nu/sidor/texter/hus/a.htm";

describe("normalizeUrl", () => {
  it("resolves relative links", () => {
    expect(normalizeUrl("../pers/b.htm", page)).toBe(
      "https://www.nykarlebyvyer.nu/sidor/texter/pers/b.htm",
    );
  });
  it("canonicalizes host, protocol and fragments", () => {
    expect(normalizeUrl("http://nykarlebyvyer.nu/sidor/x.html#top")).toBe(
      "https://www.nykarlebyvyer.nu/sidor/x.html",
    );
  });
  it("preserves path case", () => {
    expect(normalizeUrl("/sidor/kortindi/XXAX009S.HTM")).toBe(
      "https://www.nykarlebyvyer.nu/sidor/kortindi/XXAX009S.HTM",
    );
  });
  it.each([
    "mailto:a@b.c",
    "javascript:void(0)",
    "https://example.com/a.htm",
    "/bilder/foto.jpg",
    "/notfound.html",
    "/sidor/nyheter/old2501.html",
  ])("rejects %s", (href) => {
    expect(normalizeUrl(href, page)).toBeUndefined();
  });
});

describe("crawlPriority", () => {
  it("puts house pages before poetry", () => {
    expect(crawlPriority(page)).toBeLessThan(
      crawlPriority("https://www.nykarlebyvyer.nu/sidor/texter/poesi/x.htm"),
    );
  });
});

describe("isCrawlable", () => {
  it("excludes the old news archive but not other news pages", () => {
    expect(isCrawlable("https://www.nykarlebyvyer.nu/sidor/nyheter/old2501.html")).toBe(false);
    expect(isCrawlable("https://www.nykarlebyvyer.nu/sidor/nyheter/aktuellt.html")).toBe(true);
    expect(isCrawlable(page)).toBe(true);
  });
});
