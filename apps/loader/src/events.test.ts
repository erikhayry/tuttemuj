import type { PageExtraction, PlaceEntity } from "@tuttemuj/schema";
import { describe, expect, it } from "vitest";
import { buildRows } from "./rows.ts";

const url = "https://www.nykarlebyvyer.nu/sidor/a.html";

const page: PageExtraction = {
  sourceUrl: url,
  title: "A",
  summary: "s",
  topics: [],
  people: [],
  places: [{ name: "Stora bron", kind: "landmark", alternateNames: ["Storbron"] }],
  events: [
    {
      title: "Bron byggs",
      date: { year: 1890, endYear: 1892, circa: true },
      description: "Bygget tar två år.",
      people: ["Anna"],
      places: ["Stora bron"],
    },
    { title: "Utan datum", people: [], places: [] },
    { title: "Okänd plats", people: [], places: ["Någonstans"] },
  ],
  comicCandidate: null,
  contentHash: "h",
  extractionVersion: 1,
  model: "m",
  extractedAt: "2026-11-01T10:00:00.000Z",
};

const storbron: PlaceEntity = {
  id: "storbron",
  name: "storbron",
  kind: "landmark",
  aliases: ["stora bron"],
  gazetteerNames: [],
  pages: [url],
};

describe("events", () => {
  const { events, eventPlaces } = buildRows([page], [storbron], []);

  it("keeps the date, span and our description", () => {
    expect(events[0]).toMatchObject({
      id: `${url}#0`,
      year: 1890,
      end_year: 1892,
      circa: true,
      description: "Bygget tar två år.",
      people: ["Anna"],
    });
  });

  it("stores events without a date or place", () => {
    expect(events[1]).toMatchObject({ year: null, month: null, end_year: null, circa: false });
    expect(events).toHaveLength(3);
  });

  it("links an event to the place its page names, by any of the mention's names", () => {
    expect(eventPlaces).toEqual([{ event_id: `${url}#0`, place_id: "storbron" }]);
  });
});
