import { HistoricalDate } from "@tuttemuj/schema";
import { describe, expect, it } from "vitest";
import { inferEndYear } from "./end-year.ts";

describe("inferEndYear", () => {
  it.each([
    [1873, "1873-1971", 1971],
    [1876, "1876–1910", 1910],
    [1941, "uppgjord 1941–42", 1942],
    [1925, "in 1925-26", 1926],
    [1998, "1998–02", 2002],
    [1830, "på 1830-talet", 1839],
    [1830, "1830-talet", 1839],
    [1800, "1800-talet", 1899],
  ])("%i %s -> %i", (year, text, end) => {
    expect(inferEndYear({ year, text })).toBe(end);
  });

  it.each([
    [1970, "i början på 1970-talet"],
    [1835, "från mitten av 1830-talet"],
    [1920, "sedan 1920-talet"],
    [1971, "1873-1971"],
    [1873, "1873"],
    [1873, undefined],
    [1835, "1830-talet"],
  ])("leaves %i %s alone", (year, text) => {
    expect(inferEndYear({ year, ...(text ? { text } : {}) })).toBeUndefined();
  });
});

describe("HistoricalDate", () => {
  it("accepts a span and rejects an endYear that is not after year", () => {
    expect(HistoricalDate.safeParse({ year: 1873, endYear: 1971 }).success).toBe(true);
    expect(HistoricalDate.safeParse({ year: 1873 }).success).toBe(true);
    expect(HistoricalDate.safeParse({ year: 1873, endYear: 1873 }).success).toBe(false);
  });
});
