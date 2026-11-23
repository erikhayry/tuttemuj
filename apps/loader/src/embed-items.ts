import { createHash } from "node:crypto";
import { EMBEDDING_MODEL } from "@tuttemuj/schema";
import { z } from "zod";
import type { Rows } from "./rows.ts";

export type EmbedItem = {
  kind: "page" | "event" | "comic";
  ref: string;
  pageUrl: string;
  /** What is sent to the embedding model: our own summaries and descriptions, never page text. */
  text: string;
  hash: string;
};

const Pitch = z.object({ pitch: z.string() });

export const hashOf = (text: string): string =>
  createHash("sha256").update(`${EMBEDDING_MODEL}\n${text}`).digest("hex");

const yearText = (year: number | null, circa: boolean): string =>
  year === null ? "" : ` (${circa ? "ca " : ""}${year})`;

/**
 * One item per page summary, event and comic pitch. Pages that repeat another page, and their
 * events, are left out: the primary page is embedded once.
 */
export function embedItems(rows: Pick<Rows, "pages" | "events">): EmbedItem[] {
  const primary = rows.pages.filter((p) => p.duplicate_of === null);
  const titles = new Map(primary.map((p) => [p.source_url, p.title]));
  const items: Omit<EmbedItem, "hash">[] = [];

  for (const p of primary) {
    items.push({
      kind: "page",
      ref: p.source_url,
      pageUrl: p.source_url,
      text: `${p.title}\n${p.summary}`,
    });
    const comic = Pitch.safeParse(p.comic_candidate);
    if (comic.success) {
      items.push({
        kind: "comic",
        ref: p.source_url,
        pageUrl: p.source_url,
        text: `${p.title}\n${comic.data.pitch}`,
      });
    }
  }
  for (const e of rows.events) {
    const pageTitle = titles.get(e.page_url);
    if (pageTitle === undefined) continue;
    items.push({
      kind: "event",
      ref: e.id,
      pageUrl: e.page_url,
      text: `${pageTitle}: ${e.title}${yearText(e.year, e.circa)}${e.description ? `. ${e.description}` : ""}`,
    });
  }
  return items.map((i) => ({ ...i, hash: hashOf(i.text) }));
}
