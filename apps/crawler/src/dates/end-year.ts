import type { HistoricalDate } from "@tuttemuj/schema";

const RANGE = /(?<!\d)(\d{4})\s*[–-]\s*(\d{4}|\d{2})(?!\d)/;
const PERIOD = /^(?:på |under )?(\d{4})-talet$/i;

/**
 * The last year of a span, derived only from the date's own wording, or undefined.
 * Handles "1873–1971", "1941–42", "på 1830-talet" (1830–1839) and "1800-talet" (1800–1899).
 * Qualified wording ("början av 1830-talet") and dates whose `year` is not the span's start are left alone.
 */
export function inferEndYear(date: Pick<HistoricalDate, "year" | "text">): number | undefined {
  const text = date.text?.trim();
  if (!text) return undefined;

  const range = RANGE.exec(text);
  if (range) {
    const start = Number(range[1]);
    if (start !== date.year) return undefined;
    const rawEnd = range[2] as string;
    let end = Number(rawEnd);
    if (rawEnd.length === 2) {
      end += Math.floor(start / 100) * 100;
      if (end <= start) end += 100;
    }
    return end > start ? end : undefined;
  }

  const period = PERIOD.exec(text);
  if (period) {
    const start = Number(period[1]);
    if (start !== date.year) return undefined;
    if (start % 100 === 0) return start + 99;
    if (start % 10 === 0) return start + 9;
  }
  return undefined;
}
