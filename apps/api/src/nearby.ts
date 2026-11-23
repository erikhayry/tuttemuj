import { GazetteerKind, NearbyPage, type NearbyQuery, type NearbyResponse } from "@tuttemuj/schema";
import { z } from "zod";

/** One row returned by the database function `public.nearby_places`. */
export const NearbyRow = z.object({
  id: z.string(),
  name: z.string(),
  kind: GazetteerKind,
  aliases: z.array(z.string()),
  lat: z.number(),
  lng: z.number(),
  distance_m: z.number(),
  page_count: z.int(),
  pages: z.array(NearbyPage),
});
export type NearbyRow = z.infer<typeof NearbyRow>;

/** How the API reaches the database. Replaced in tests. */
export type NearbySource = (query: NearbyQuery) => Promise<unknown>;

export async function nearby(source: NearbySource, query: NearbyQuery): Promise<NearbyResponse> {
  const rows = z.array(NearbyRow).parse(await source(query));
  return {
    places: rows.map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      aliases: r.aliases,
      lat: r.lat,
      lng: r.lng,
      distanceM: Math.round(r.distance_m),
      pageCount: r.page_count,
      pages: r.pages,
    })),
  };
}
