import type { PlaceEntity } from "@tuttemuj/schema";
import type { PageRow, Rows } from "./rows.ts";

// The test fixture (docs/testing.md): a small slice of the real derived data around the test spots,
// so the feature and property tests check real answers and stay small. Only derived facts are
// copied (places, pages, events, our own summaries); no page text is ever stored.

/** The spots the tests stand at, from `data/sources/manual-places.json`. Andrasjön has no coordinates yet (#40). */
export const FIXTURE_SPOTS = [
  { name: "torget", lat: 63.522438, lng: 22.528594 },
  { name: "storbron", lat: 63.522451, lng: 22.524766 },
  { name: "brostugan", lat: 63.522469, lng: 22.5233788 },
] as const;

/**
 * Places within this many metres of a spot are in the fixture. 100 m gives about 50 places and 900
 * pages: popular places are mentioned on many pages, so a wider radius pulls in far more pages.
 */
export const FIXTURE_RADIUS_M = 100;

/** Great-circle distance in metres (haversine). Good enough for a few hundred metres. */
export const distanceM = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/** The ids of the places that have a location within the radius of a spot. */
export const placesNearSpots = (places: readonly PlaceEntity[]): Set<string> =>
  new Set(
    places
      .filter(
        (p) =>
          p.location !== undefined &&
          FIXTURE_SPOTS.some(
            (s) => distanceM(s, p.location as { lat: number; lng: number }) <= FIXTURE_RADIUS_M,
          ),
      )
      .map((p) => p.id),
  );

/**
 * Keep the rows about `placeIds`: their pages, and everything on those pages that is about them.
 * A link is kept only when both ends are kept, so no row points at something missing.
 */
export const pickFixture = (rows: Rows, placeIds: ReadonlySet<string>): Rows => {
  const places = rows.places.filter((p) => placeIds.has(p.id));
  const pageUrls = new Set(
    rows.pagePlaces.filter((l) => placeIds.has(l.place_id)).map((l) => l.page_url),
  );
  // A page is kept when it mentions a kept place. Its duplicates are kept only if it is.
  const pages: PageRow[] = rows.pages
    .filter((p) => pageUrls.has(p.source_url))
    .map((p) => ({
      ...p,
      duplicate_of: p.duplicate_of !== null && pageUrls.has(p.duplicate_of) ? p.duplicate_of : null,
    }));
  const keptPages = new Set(pages.map((p) => p.source_url));
  const onKeptPage = <T extends { page_url: string }>(list: readonly T[]) =>
    list.filter((r) => keptPages.has(r.page_url));
  const onKeptPlace = <T extends { place_id: string }>(list: readonly T[]) =>
    list.filter((r) => placeIds.has(r.place_id));

  const events = onKeptPage(rows.events);
  const keptEvents = new Set(events.map((e) => e.id));
  const keptImages = new Set(onKeptPage(rows.imageFacts).map((i) => i.id));

  return {
    pages,
    places,
    pagePlaces: onKeptPlace(onKeptPage(rows.pagePlaces)),
    events,
    eventPlaces: rows.eventPlaces.filter(
      (l) => keptEvents.has(l.event_id) && placeIds.has(l.place_id),
    ),
    pagePeople: onKeptPage(rows.pagePeople),
    placeUses: onKeptPlace(onKeptPage(rows.placeUses)),
    relations: onKeptPlace(onKeptPage(rows.relations)),
    imageFacts: onKeptPage(rows.imageFacts),
    imageFactPlaces: rows.imageFactPlaces.filter(
      (l) => keptImages.has(l.image_id) && placeIds.has(l.place_id),
    ),
    pageImages: onKeptPage(rows.pageImages),
  };
};
