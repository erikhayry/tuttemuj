import { z } from "zod";
import { PlaceGeo } from "./gazetteer.ts";
import { PlaceKind } from "./place-kind.ts";
import { SourceUrl } from "./source.ts";

/** A date as precise as the source allows, e.g. "ca 1850", "maj 1918". */
export const HistoricalDate = z.object({
  year: z.int(),
  month: z.int().min(1).max(12).optional(),
  day: z.int().min(1).max(31).optional(),
  circa: z.boolean().default(false),
  /** Original wording from the source. */
  text: z.string().optional(),
});
export type HistoricalDate = z.infer<typeof HistoricalDate>;

export const PersonMention = z.object({
  name: z.string().min(1),
  alternateNames: z.array(z.string()).default([]),
  birthYear: z.int().optional(),
  deathYear: z.int().optional(),
  roles: z.array(z.string()).default([]).describe("e.g. occupation, title"),
  description: z.string().optional(),
});
export type PersonMention = z.infer<typeof PersonMention>;

export const PlaceMention = z.object({
  name: z.string().min(1),
  kind: PlaceKind,
  alternateNames: z.array(z.string()).default([]),
  /** Address as written in the source (may be historical). */
  address: z.string().optional(),
  description: z.string().optional(),
  /** Added by geocoding against data/gazetteer.json, never by the analyst. */
  geo: PlaceGeo.optional(),
});
export type PlaceMention = z.infer<typeof PlaceMention>;

/** What the analyst writes for a place: everything except the geocoded location. */
export const PlaceMentionDraft = PlaceMention.omit({ geo: true });

export const EventMention = z.object({
  title: z.string().min(1),
  date: HistoricalDate.optional(),
  description: z.string().optional(),
  people: z.array(z.string()).default([]).describe("Names matching PersonMention.name"),
  places: z.array(z.string()).default([]).describe("Names matching PlaceMention.name"),
});
export type EventMention = z.infer<typeof EventMention>;

/**
 * Derived facts from one source page (data/pages/<id>.json).
 * Never contains the page text itself, only our own summary and extracted facts.
 */
export const PageExtraction = z.object({
  sourceUrl: SourceUrl,
  title: z.string(),
  summary: z.string().describe("Short summary in our own words (Swedish)"),
  topics: z.array(z.string()).default([]),
  people: z.array(PersonMention).default([]),
  places: z.array(PlaceMention).default([]),
  events: z.array(EventMention).default([]),
  contentHash: z.string(),
  extractionVersion: z.int().positive(),
  model: z.string(),
  extractedAt: z.iso.datetime(),
});
export type PageExtraction = z.infer<typeof PageExtraction>;

/** Bump when the extraction instructions or schema change, so pages get re-analysed. */
export const EXTRACTION_VERSION = 1;

/**
 * What the analyst (Claude Code, run manually) writes for one page.
 * Bookkeeping fields (hash, version, timestamp) are stamped by `extract:save`.
 */
export const PageExtractionDraft = PageExtraction.omit({
  contentHash: true,
  extractionVersion: true,
  extractedAt: true,
}).extend({ places: z.array(PlaceMentionDraft).default([]) });
export type PageExtractionDraft = z.infer<typeof PageExtractionDraft>;

/** One page handed out for analysis (.cache/extract/batch.json). */
export const ExtractionTask = z.object({
  sourceUrl: SourceUrl,
  title: z.string(),
  contentHash: z.string(),
  textPath: z.string(),
  draftPath: z.string(),
});
export type ExtractionTask = z.infer<typeof ExtractionTask>;
