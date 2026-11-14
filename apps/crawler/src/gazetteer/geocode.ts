import type {
  GazetteerEntry,
  GeoPoint,
  PageExtraction,
  PlaceGeo,
  PlaceMention,
} from "@tuttemuj/schema";
import { normalizeName } from "./build.ts";

const STREETLIKE = new Set(["street", "address"]);

type Located = GazetteerEntry & { location: GeoPoint };
const isLocated = (e: GazetteerEntry): e is Located => e.location !== undefined;

/** Looks up PlaceMentions in the gazetteer. Only entries with a trusted location are used. */
export class Gazetteer {
  private readonly byName = new Map<string, Located>();

  constructor(entries: GazetteerEntry[]) {
    for (const e of entries.filter(isLocated)) {
      for (const name of [e.name, ...(e.alternateNames ?? [])])
        this.byName.set(normalizeName(name), e);
    }
  }

  locate(place: PlaceMention): PlaceGeo | undefined {
    if (place.address) {
      const hit = this.byName.get(normalizeName(place.address));
      if (hit) return toGeo(hit, "address");
    }
    for (const name of [place.name, ...place.alternateNames]) {
      const hit = this.byName.get(normalizeName(name));
      // A street name only locates a place that is itself a street (not e.g. a farm of the same name).
      if (hit && (!STREETLIKE.has(hit.kind) || place.kind === "street")) return toGeo(hit, "name");
    }
    return undefined;
  }

  /** Recompute `geo` for every place on a page (drops stale matches). */
  geocodePage(page: PageExtraction): PageExtraction {
    const places = page.places.map(({ geo: _old, ...place }) => {
      const geo = this.locate(place);
      return geo ? { ...place, geo } : place;
    });
    return { ...page, places };
  }
}

const toGeo = (e: Located, match: PlaceGeo["match"]): PlaceGeo => ({
  ...e.location,
  match,
  gazetteerName: e.name,
  gazetteerKind: e.kind,
  source: e.source,
});
