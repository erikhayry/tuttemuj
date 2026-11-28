import { expect, test } from "@playwright/test";
import { ButtonResultsResponse, ButtonsResponse, PlacesNearResponse } from "@tuttemuj/schema";
import { Schema } from "effect";
import { BUTTON_IDS, queryString, SOURCE_HOST, TORGET } from "./support.ts";

// Feature tests: one per thing a client of the API can do (docs/testing.md). They run against the
// real server and the seeded test database, and check the answer the way a client would read it.
// Schemas are the same ones the server answers with, so a shape change fails here first.

test("the service answers health checks", async ({ request }) => {
  const res = await request.get("/health");
  expect(res.status()).toBe(204);
});

test("places near Torget are located, nearest first, and each has pages", async ({ request }) => {
  const res = await request.get(`/places/near?${queryString(TORGET)}`);
  expect(res.status()).toBe(200);

  const { places } = Schema.decodeUnknownSync(PlacesNearResponse)(await res.json());
  expect(places.length).toBeGreaterThan(0);

  const distances = places.map((place) => place.distanceM);
  expect(distances).toEqual([...distances].sort((a, b) => a - b));
  // A place is only listed when pages mention it, so the visitor has something to read.
  for (const place of places) expect(place.pageCount).toBeGreaterThan(0);
});

test("buttons at Torget list only buttons with results, in button order", async ({ request }) => {
  const res = await request.get(`/buttons?${queryString(TORGET)}`);
  expect(res.status()).toBe(200);

  const { buttons } = Schema.decodeUnknownSync(ButtonsResponse)(await res.json());
  expect(buttons.length).toBeGreaterThan(0);

  const positions = buttons.map((b) => BUTTON_IDS.indexOf(b.button));
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
});

test("each of the 10 buttons answers with results that link to nykarlebyvyer.nu", async ({
  request,
}) => {
  for (const id of BUTTON_IDS) {
    const res = await request.get(`/buttons/${id}?${queryString(TORGET)}`);
    expect(res.status(), id).toBe(200);

    const { button, results } = Schema.decodeUnknownSync(ButtonResultsResponse)(await res.json());
    expect(button).toBe(id);
    for (const result of results) {
      expect(result.button, id).toBe(id);
      // `nearby` answers with places, not pages, so it has no source link of its own.
      if ("sourceUrl" in result) expect(new URL(result.sourceUrl).hostname, id).toBe(SOURCE_HOST);
    }
  }
});

test("bad input is rejected with 400 before it reaches the database", async ({ request }) => {
  const badRequests = [
    `/places/near?${queryString({ ...TORGET, lat: 10 })}`, // outside Nykarleby
    `/places/near?${queryString({ ...TORGET, radius: "abc" })}`, // not a number
    `/places/near?${queryString({ ...TORGET, radius: 5000 })}`, // wider than the limit
    `/buttons?${queryString({ ...TORGET, limit: 0 })}`, // fewer than one result
    `/buttons/not-a-button?${queryString(TORGET)}`, // not one of the 10 buttons
  ];
  for (const path of badRequests) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(400);
  }
});
