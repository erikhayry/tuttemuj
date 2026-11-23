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
};

describe("GET /nearby", () => {
  it("returns places with distance rounded and passes the query to the source", async () => {
    const source = vi.fn<NearbySource>().mockResolvedValue([row]);
    const res = await createApp(source).request("/nearby?lat=63.5224&lng=22.5245&radius=300");
    expect(res.status).toBe(200);
    expect(source).toHaveBeenCalledWith({ lat: 63.5224, lng: 22.5245, radius: 300, limit: 20 });
    const body = await res.json();
    expect(body.places[0]).toMatchObject({ id: "storbron", distanceM: 42, pageCount: 12 });
  });

  it("uses a walking radius by default", async () => {
    const source = vi.fn<NearbySource>().mockResolvedValue([]);
    await createApp(source).request("/nearby?lat=63.5224&lng=22.5245");
    expect(source).toHaveBeenCalledWith(expect.objectContaining({ radius: 200 }));
  });

  it.each([
    "/nearby",
    "/nearby?lat=abc&lng=22.5",
    "/nearby?lat=60&lng=22.5",
    "/nearby?lat=63.5&lng=22.5&radius=50000",
  ])("rejects %s", async (url) => {
    const source = vi.fn<NearbySource>();
    const res = await createApp(source).request(url);
    expect(res.status).toBe(400);
    expect(source).not.toHaveBeenCalled();
  });

  it("hides database errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const source = vi.fn<NearbySource>().mockRejectedValue(new Error("secret detail"));
    const res = await createApp(source).request("/nearby?lat=63.5&lng=22.5");
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("secret");
  });
});
