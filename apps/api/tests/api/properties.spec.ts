import { expect, test } from "@playwright/test";
import {
  ButtonId,
  ButtonQuery,
  ButtonResultsResponse,
  ButtonsResponse,
  PlacesNearResponse,
  PositionQuery,
} from "@tuttemuj/schema";
import { Arbitrary, Effect, Schema } from "effect";
import { BUTTON_IDS, MAX_TEXT_LENGTH, queryString, SOURCE_HOST } from "./support.ts";

// Property tests (docs/testing.md): generated requests, and properties that must hold for every
// answer. Effect's `Arbitrary` builds the values from the same schemas the server uses, so the
// generated input is always the shape the API expects, and `checkEffect` shrinks a failing input
// to a small one. Like fast-check, but built into Effect and driven by a schema.

/** Runs `property` on generated values. A failure is shrunk, then reported with the smallest input. */
const forAll = async <A>(
  name: string,
  arb: Arbitrary.Arbitrary<A>,
  property: (value: A) => Promise<void>,
  runs = 20,
) => {
  const result = await Effect.runPromise(
    Arbitrary.checkEffect(
      arb,
      (value) =>
        // A thrown `expect` inside `property` becomes a typed failure, so the input is shrunk.
        Effect.tryPromise({
          try: () => property(value).then(() => true),
          catch: (error) => error,
        }),
      { runs },
    ),
  );
  if (result._tag !== "Passed") {
    throw new Error(`${name}\n${Arbitrary.formatCheckFailure(result) ?? "failed"}`);
  }
};

/** A query the API should accept: a position inside Nykarleby, a radius and a limit in range. */
const validQuery = Arbitrary.schema(ButtonQuery);
/** Any finite numbers, inside Nykarleby or not, to check that outside positions are refused. */
const anyNumbers = Arbitrary.schema(
  Schema.Struct({
    lat: Schema.Finite,
    lng: Schema.Finite,
    radius: Schema.Finite,
  }),
);
const buttonId = Arbitrary.schema(ButtonId);

/** The query string the server sees, with the same values the arbitrary generated. */
const pathFor = (path: string, query: Record<string, unknown>) => `${path}?${queryString(query)}`;

const expectSourceLinks = (results: ReadonlyArray<object>) => {
  for (const result of results) {
    if ("sourceUrl" in result) {
      expect(new URL(result.sourceUrl as string).hostname).toBe(SOURCE_HOST);
    }
    if ("imageUrl" in result) {
      expect(new URL(result.imageUrl as string).hostname).toBe(SOURCE_HOST);
    }
  }
};

const expectShortText = (value: unknown, path: string) => {
  if (typeof value === "string") {
    expect(value.length, path).toBeLessThanOrEqual(MAX_TEXT_LENGTH);
  } else if (Array.isArray(value)) {
    for (const [i, item] of value.entries()) expectShortText(item, `${path}[${i}]`);
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) expectShortText(item, `${path}.${key}`);
  }
};

test("valid input always gets a schema-valid answer with source links, within radius and limit", async ({
  request,
}) => {
  await forAll(
    "button results",
    Arbitrary.all({ query: validQuery, id: buttonId }),
    async ({ query, id }) => {
      const res = await request.get(pathFor(`/buttons/${id}`, query));
      expect(res.status()).toBe(200);

      const body = Schema.decodeUnknownSync(ButtonResultsResponse)(await res.json());
      expect(body.results.length).toBeLessThanOrEqual(query.limit);
      expectSourceLinks(body.results);
      expectShortText(body.results, "results");
      for (const result of body.results) {
        // Distances are rounded to whole metres, so allow one metre over the radius.
        expect(result.distanceM).toBeLessThanOrEqual(query.radius + 1);
      }
    },
  );
});

test("the count in GET /buttons equals the number of results in GET /buttons/:id", async ({
  request,
}) => {
  await forAll(
    "count consistency",
    validQuery,
    async (query) => {
      const res = await request.get(pathFor("/buttons", query));
      expect(res.status()).toBe(200);
      const { buttons } = Schema.decodeUnknownSync(ButtonsResponse)(await res.json());

      // Buttons not in the list have no results, so only the listed ones need a second request.
      for (const { button, count } of buttons) {
        const detail = await request.get(pathFor(`/buttons/${button}`, query));
        const { results } = Schema.decodeUnknownSync(ButtonResultsResponse)(await detail.json());
        expect(results.length, button).toBe(count);
      }
    },
    10,
  );
});

test("nearby places are schema-valid and never farther than the radius", async ({ request }) => {
  await forAll(
    "places near",
    validQuery,
    async (query) => {
      const res = await request.get(pathFor("/places/near", query));
      expect(res.status()).toBe(200);
      const { places } = Schema.decodeUnknownSync(PlacesNearResponse)(await res.json());
      for (const place of places) {
        expect(place.distanceM).toBeLessThanOrEqual(query.radius + 1);
      }
    },
    10,
  );
});

test("positions outside Nykarleby or radii out of range get 400, never 500", async ({
  request,
}) => {
  await forAll(
    "bad positions",
    anyNumbers,
    async ({ lat, lng, radius }) => {
      // The same rule the server uses (`PositionQuery`), so the expectation is not re-typed here.
      const valid = Schema.is(PositionQuery)({ lat, lng, radius });
      const res = await request.get(pathFor("/places/near", { lat, lng, radius }));
      // Only a fully valid position may reach the database; everything else is a client error.
      expect(res.status()).toBe(valid ? 200 : 400);
    },
    40,
  );
});

test("an unknown button id is always 400", async ({ request }) => {
  await forAll(
    "unknown buttons",
    // Plain words only: `.` or `..` would be normalized by the client before it reaches the server.
    Arbitrary.schema(Schema.String.check(Schema.isPattern(/^[a-z-]{1,30}$/))),
    async (id) => {
      if ((BUTTON_IDS as readonly string[]).includes(id)) return;
      const res = await request.get(pathFor(`/buttons/${encodeURIComponent(id)}`, {}));
      expect(res.status(), id).toBe(400);
    },
    20,
  );
});
