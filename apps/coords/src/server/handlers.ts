import { GeoPoint, normalizeName, safeDecode } from "@tuttemuj/schema";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";
import { CoordsApi } from "./api.ts";
import { CoordsData } from "./data.ts";
import { ignoreOutside, readIgnoredNames } from "./ignored-places.ts";
import { readManualPlaces, saveLocation } from "./manual-places.ts";
import { parseCoords } from "./parse-coords.ts";
import { describePlace } from "./place.ts";

/** Names with coordinates in the manual file. */
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
          // Both files may have changed since the gazetteer was last built.
          const [located, ignored] = await Promise.all([
            locatedByHand(data.dataDir),
            readIgnoredNames(data.dataDir),
          ]);
          const open = data.ranked.filter((p) => !located.has(p.name) && !ignored.has(p.name));
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
      )
      .handle("ignore", ({ payload }) =>
        Effect.promise(async () => {
          const entry = data.entries.get(payload.name);
          if (!entry) throw new Error(`Unknown place: ${payload.name}`);
          // The other names too, so `places:unmatched` does not report them as new places. A name
          // that is also a place of its own is left alone.
          const others = (entry.alternateNames ?? []).filter(
            (n) => !data.entries.has(normalizeName(n)),
          );
          await ignoreOutside(data.dataDir, [entry.name, ...others]);
          return { name: entry.name };
        }),
      );
  }),
);
