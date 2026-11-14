import * as cheerio from "cheerio";
import { describe, expect, it } from "vitest";
import { findImages, isLargeImage } from "./images.ts";

const PAGE = "https://www.nykarlebyvyer.nu/sidor/karta/a.htm";
const IMG = "https://www.nykarlebyvyer.nu/bilder/kartor";

const find = (body: string) => findImages(cheerio.load(`<html><body>${body}</body></html>`), PAGE);

describe("isLargeImage", () => {
  it("keeps large images and drops icons and thin strips", () => {
    expect(isLargeImage(571, 724)).toBe(true);
    expect(isLargeImage(241, 700)).toBe(true);
    expect(isLargeImage(18, 9)).toBe(false);
    expect(isLargeImage(309, 28)).toBe(false);
  });
});

describe("findImages", () => {
  it("returns large images with absolute URLs and alt text", () => {
    expect(
      find(`
        <img src="../../gif/P2.GIF" width="18" height="9">
        <IMG SRC="../../bilder/kartor/1800-skala.jpg" WIDTH="309" HEIGHT="28">
        <img src="../../bilder/kartor/1800-4.JPG" width="571" height="724" alt=" Karta  1800 ">
        <img src="../../bilder/kartor/1800-4.JPG" width="571" height="724">
      `),
    ).toEqual([{ url: `${IMG}/1800-4.JPG`, width: 571, height: 724, alt: "Karta 1800" }]);
  });

  it("keeps thumbnails that link to a larger version", () => {
    expect(
      find(
        '<a href="../../bilder/kartor/big.jpg"><img src="../../bilder/kartor/t.jpg" width="120" height="90"></a>',
      ),
    ).toEqual([{ url: `${IMG}/t.jpg`, width: 120, height: 90, fullUrl: `${IMG}/big.jpg` }]);
  });

  it("skips images without a declared pixel size or on other hosts", () => {
    expect(
      find(`
        <img src="../../bilder/a.jpg">
        <img src="../../bilder/b.jpg" width="100%" height="400">
        <img src="https://example.com/c.jpg" width="800" height="600">
      `),
    ).toEqual([]);
  });
});
