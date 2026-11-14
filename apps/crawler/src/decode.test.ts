import { describe, expect, it } from "vitest";
import { decodeHtml } from "./decode.ts";

const latin1 = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));

describe("decodeHtml", () => {
  it("uses the meta charset", () => {
    const html = '<meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1">gård';
    expect(decodeHtml(latin1(html))).toContain("gård");
  });
  it("prefers the header charset", () => {
    const bytes = new TextEncoder().encode("<p>Kyrkogård</p>");
    expect(decodeHtml(bytes, "text/html; charset=utf-8")).toContain("Kyrkogård");
  });
  it("falls back to windows-1252 for undeclared non-UTF-8 bytes", () => {
    expect(decodeHtml(latin1("<p>Österbotten</p>"))).toContain("Österbotten");
  });
});
