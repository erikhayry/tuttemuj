import type { SourceUrl } from "@tuttemuj/schema";
import { decodeHtml } from "./decode.ts";

export type FetchResult =
  | { kind: "ok"; status: number; html: string; lastModified?: string }
  | { kind: "gone"; status: number }
  | { kind: "error"; status?: number; error: string };

export type FetchOptions = {
  userAgent: string;
  timeoutMs: number;
  fetch?: typeof globalThis.fetch;
};

export async function fetchPage(url: SourceUrl, opts: FetchOptions): Promise<FetchResult> {
  const doFetch = opts.fetch ?? globalThis.fetch;
  try {
    const res = await doFetch(url, {
      headers: { "User-Agent": opts.userAgent, Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(opts.timeoutMs),
    });
    // The site redirects missing pages to /notfound.html instead of returning 404.
    if (res.status === 404 || res.status === 410 || /\/notfound\.html$/i.test(res.url)) {
      return { kind: "gone", status: res.status };
    }
    if (!res.ok) return { kind: "error", status: res.status, error: `HTTP ${res.status}` };

    const bytes = new Uint8Array(await res.arrayBuffer());
    const html = decodeHtml(bytes, res.headers.get("content-type"));
    const lastModified = res.headers.get("last-modified") ?? undefined;
    return { kind: "ok", status: res.status, html, ...(lastModified ? { lastModified } : {}) };
  } catch (err) {
    return { kind: "error", error: err instanceof Error ? err.message : String(err) };
  }
}
