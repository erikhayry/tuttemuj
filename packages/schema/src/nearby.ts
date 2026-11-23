import { z } from "zod";
import { HistoricalDate } from "./entities.ts";
import { GazetteerKind } from "./gazetteer.ts";
import { SourceUrl } from "./source.ts";

/** Query of GET /nearby. Values arrive as strings, so numbers are coerced. */
export const NearbyQuery = z.object({
  /** Same bounds as GeoPoint: Nykarleby and its surroundings. */
  lat: z.coerce.number().min(63.3).max(63.75),
  lng: z.coerce.number().min(21.7).max(23.2),
  /** Metres. Walking distance by default. */
  radius: z.coerce.number().int().min(10).max(2000).default(200),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type NearbyQuery = z.infer<typeof NearbyQuery>;

/** A page that mentions a place: our own title and summary, and the link to read the original. */
export const NearbyPage = z.object({
  sourceUrl: SourceUrl,
  title: z.string(),
  summary: z.string(),
});
export type NearbyPage = z.infer<typeof NearbyPage>;

/** An event at a place, with the page it comes from. Description is our own wording. */
export const NearbyEvent = z.object({
  sourceUrl: SourceUrl,
  title: z.string(),
  date: HistoricalDate.optional(),
  description: z.string().optional(),
});
export type NearbyEvent = z.infer<typeof NearbyEvent>;

export const NearbyPlace = z.object({
  id: z.string(),
  name: z.string(),
  kind: GazetteerKind,
  aliases: z.array(z.string()),
  lat: z.number(),
  lng: z.number(),
  distanceM: z.number().int().min(0),
  /** All pages mentioning the place; `pages` holds only the first few. */
  pageCount: z.int().min(0),
  pages: z.array(NearbyPage),
  /** All events at the place; `events` holds the first few in date order, undated last. */
  eventCount: z.int().min(0),
  events: z.array(NearbyEvent),
});
export type NearbyPlace = z.infer<typeof NearbyPlace>;

/** Response of GET /nearby: the closest places first. Never contains page text. */
export const NearbyResponse = z.object({
  places: z.array(NearbyPlace),
});
export type NearbyResponse = z.infer<typeof NearbyResponse>;
