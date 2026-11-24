import {
  GazetteerKind,
  NearbyEvent,
  NearbyPage,
  type NearbyQuery,
  type NearbyResponse,
} from "@tuttemuj/schema";
import { Schema } from "effect";

/** One row returned by the database function `public.nearby_places`. */
export const NearbyRow = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  kind: GazetteerKind,
  aliases: Schema.Array(Schema.String),
  lat: Schema.Number,
  lng: Schema.Number,
  distance_m: Schema.Number,
  page_count: Schema.Int,
  pages: Schema.Array(NearbyPage),
  event_count: Schema.Int,
  events: Schema.Array(NearbyEvent),
});
export type NearbyRow = typeof NearbyRow.Type;

/** How the API reaches the database. Replaced in tests. */
export type NearbySource = (query: NearbyQuery) => Promise<unknown>;

export async function nearby(source: NearbySource, query: NearbyQuery): Promise<NearbyResponse> {
  const rows = Schema.decodeUnknownSync(Schema.Array(NearbyRow))(await source(query));
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
      eventCount: r.event_count,
      events: r.events,
    })),
  };
}
