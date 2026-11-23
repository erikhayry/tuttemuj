import { describe, expect, it, vi } from "vitest";
import { createApp } from "./app.ts";
import type { NearbySource } from "./nearby.ts";

const row = {
  id: "storbron",
  name: "storbron",
  kind: "landmark",
  aliases: ["stora bron"],
  lat: 63.522451,
  lng: 22.524766,
  distance_m: 41.6,
  page_count: 12,
  pages: [
    {
      sourceUrl: "https://www.nykarlebyvyer.nu/sidor/a.html",
      title: "Storbron",
      summary: "Om bron.",
    },
  ],
  event_count: 3,
  events: [
    {
      sourceUrl: "https://www.nykarlebyvyer.nu/sidor/a.html",
      title: "Bron byggs",
      date: { year: 1890, circa: false },
    },
  ],
};

describe("GET /nearby", () => {
  it("returns places with distance rounded and passes the query to the source", async () => {
    const source = vi.fn<NearbySource>().mockResolvedValue([row]);
    const res = await createApp({ nearby: source }).request(
      "/nearby?lat=63.5224&lng=22.5245&radius=300",
    );
    expect(res.status).toBe(200);
    expect(source).toHaveBeenCalledWith({ lat: 63.5224, lng: 22.5245, radius: 300, limit: 20 });
    const body = await res.json();
    expect(body.places[0]).toMatchObject({
      id: "storbron",
      distanceM: 42,
      pageCount: 12,
      eventCount: 3,
    });
    expect(body.places[0].events[0].date.year).toBe(1890);
  });

  it("uses a walking radius by default", async () => {
    const source = vi.fn<NearbySource>().mockResolvedValue([]);
    await createApp({ nearby: source }).request("/nearby?lat=63.5224&lng=22.5245");
    expect(source).toHaveBeenCalledWith(expect.objectContaining({ radius: 200 }));
  });

  it.each([
    "/nearby",
    "/nearby?lat=abc&lng=22.5",
    "/nearby?lat=60&lng=22.5",
    "/nearby?lat=63.5&lng=22.5&radius=50000",
  ])("rejects %s", async (url) => {
    const source = vi.fn<NearbySource>();
    const res = await createApp({ nearby: source }).request(url);
    expect(res.status).toBe(400);
    expect(source).not.toHaveBeenCalled();
  });

  it("hides database errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const source = vi.fn<NearbySource>().mockRejectedValue(new Error("secret detail"));
    const res = await createApp({ nearby: source }).request("/nearby?lat=63.5&lng=22.5");
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("secret");
  });
});

describe("POST /ask", () => {
  const nearby = vi.fn<NearbySource>();
  const post = (app: ReturnType<typeof createApp>, body: unknown) =>
    app.request("/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  it("passes a valid question on, with Swedish as the default language", async () => {
    const ask = vi.fn().mockResolvedValue({
      mode: "answer",
      answer: "Svar [1].",
      grounded: true,
      sources: [],
      suggestions: [],
    });
    const res = await post(createApp({ nearby, ask }), {
      question: "Vad hände vid torget?",
      lat: 63.5224,
      lng: 22.5285,
    });
    expect(res.status).toBe(200);
    expect(ask).toHaveBeenCalledWith({
      question: "Vad hände vid torget?",
      lat: 63.5224,
      lng: 22.5285,
      lang: "sv",
    });
  });

  it.each([
    { question: "hi" },
    { question: "Vad hände vid torget?", lat: 63.5 },
    { question: "Vad hände vid torget?", lat: 10, lng: 22.5 },
    { question: "Vad hände vid torget?", lang: "de" },
    "not an object",
  ])("rejects %j", async (body) => {
    const ask = vi.fn();
    const res = await post(createApp({ nearby, ask }), body);
    expect(res.status).toBe(400);
    expect(ask).not.toHaveBeenCalled();
  });

  it("answers 503 when ask is not configured", async () => {
    const res = await post(createApp({ nearby }), { question: "Vad hände vid torget?" });
    expect(res.status).toBe(503);
  });
});
