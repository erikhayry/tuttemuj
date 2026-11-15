import { describe, expect, it } from "vitest";
import { FrontierEntry, PageExtractionDraft, SourceUrl } from "./index.ts";

describe("SourceUrl", () => {
  it("accepts site URLs", () => {
    expect(SourceUrl.safeParse("https://www.nykarlebyvyer.nu/sidor/index2.htm").success).toBe(true);
  });
  it("rejects other hosts", () => {
    expect(SourceUrl.safeParse("https://example.com/a.htm").success).toBe(false);
  });
});

describe("FrontierEntry", () => {
  it("parses a pending entry", () => {
    const entry = FrontierEntry.parse({
      url: "https://www.nykarlebyvyer.nu/sidor/index2.htm",
      status: "pending",
      discoveredAt: "2026-11-14T00:00:00Z",
      attempts: 0,
    });
    expect(entry.status).toBe("pending");
  });
});

describe("PageExtractionDraft", () => {
  const base = {
    sourceUrl: "https://www.nykarlebyvyer.nu/a.htm",
    title: "A",
    summary: "S",
    model: "m",
  };
  it("requires an explicit comicCandidate decision", () => {
    expect(PageExtractionDraft.safeParse(base).success).toBe(false);
    expect(PageExtractionDraft.safeParse({ ...base, comicCandidate: null }).success).toBe(true);
    expect(
      PageExtractionDraft.safeParse({
        ...base,
        comicCandidate: { potential: "high", pitch: "P", reason: "R" },
      }).success,
    ).toBe(true);
  });
});
