import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { rateLimit } from "./rate-limit.ts";

const appWith = (max: number, windowMs: number, now: () => number) =>
  new Hono().use("*", rateLimit({ max, windowMs, now })).get("/", (c) => c.text("ok"));

describe("rateLimit", () => {
  it("allows max requests per window, then returns 429 with Retry-After", async () => {
    const app = appWith(2, 10_000, () => 0);
    expect((await app.request("/")).status).toBe(200);
    expect((await app.request("/")).status).toBe(200);
    const blocked = await app.request("/");
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBe("10");
  });

  it("opens a new window after windowMs", async () => {
    let t = 0;
    const app = appWith(1, 1_000, () => t);
    expect((await app.request("/")).status).toBe(200);
    expect((await app.request("/")).status).toBe(429);
    t = 1_000;
    expect((await app.request("/")).status).toBe(200);
  });

  it("counts each X-Forwarded-For client separately", async () => {
    const app = appWith(1, 10_000, () => 0);
    const from = (ip: string) => app.request("/", { headers: { "x-forwarded-for": ip } });
    expect((await from("1.1.1.1")).status).toBe(200);
    expect((await from("1.1.1.1")).status).toBe(429);
    expect((await from("2.2.2.2, 9.9.9.9")).status).toBe(200);
  });
});
