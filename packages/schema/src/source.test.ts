import { describe, expect, it } from "vitest";
import { FrontierEntry, SourceUrl } from "./index.ts";

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
