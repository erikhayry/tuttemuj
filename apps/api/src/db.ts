import { createClient } from "@supabase/supabase-js";
import type { NearbySource } from "./nearby.ts";

/** Reads with the service role: the tables have no public policies. Keep this key on the server. */
export function supabaseSource(url: string, key: string): NearbySource {
  const db = createClient(url, key, { auth: { persistSession: false } });
  return async (q) => {
    const { data, error } = await db.rpc("nearby_places", {
      in_lat: q.lat,
      in_lng: q.lng,
      in_radius_m: q.radius,
      in_max_places: q.limit,
    });
    if (error) throw new Error(`nearby_places: ${error.message}`);
    return data;
  };
}
