import { GeoPoint, normalizeName, safeDecode } from "@tuttemuj/schema";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";
import { CoordsApi } from "./api.ts";
import { CoordsData } from "./data.ts";
import { readManualPlaces, saveLocation } from "./manual-places.ts";
import { parseCoords } from "./parse-coords.ts";
import { describePlace } from "./place.ts";

/** Names located since the gazetteer was last built: they are in the manual file only. */
const locatedByHand = async (dataDir: string) =>
  new Set(
    (await readManualPlaces(dataDir)).flatMap((p) => (p.location ? [normalizeName(p.name)] : [])),
  );

const rejected = (reason: "unreadable" | "outside-area" | "already-located") => ({
  result: "rejected" as const,
  reason,
});

export const CoordsHandlers = HttpApiBuilder.group(
  CoordsApi,
  "coords",
  Effect.fn(function* (handlers) {
    const data = yield* CoordsData;
    return handlers
      .handle("next", ({ payload }) =>
        // `Effect.promise` wraps async code that is not expected to fail: a rejection becomes a
        // "defect", which the server answers with a 500.
        Effect.promise(async () => {
          const located = await locatedByHand(data.dataDir);
          const open = data.ranked.filter((p) => !located.has(p.name));
          const skipped = new Set(payload.skipped);
          const next = open.find((p) => !skipped.has(p.name));
          return { place: next ? describePlace(data, next) : null, remaining: open.length };
        }),
      )
      .handle("save", ({ payload }) =>
        Effect.promise(async () => {
          const entry = data.entries.get(payload.name);
          if (!entry) throw new Error(`Unknown place: ${payload.name}`);
          const parsed = parseCoords(payload.input);
          if (!parsed) return rejected("unreadable");
          // `GeoPoint` only accepts the Nykarleby area, so a namesake in Sweden is refused.
          const point = safeDecode(GeoPoint)(parsed);
          if (!point.success) return rejected("outside-area");
          const saved = await saveLocation(data.dataDir, {
            name: entry.name,
            kind: entry.kind,
            location: point.data,
          });
          return saved
            ? { result: "saved" as const, name: entry.name, location: point.data }
            : rejected("already-located");
        }),
      );
  }),
);
