import { FrontierEntry, type SourceUrl } from "@tuttemuj/schema";
import { readJsonl, writeJsonl } from "./jsonl.ts";
import { crawlPriority } from "./url.ts";

/** The set of known URLs and their crawl state, persisted as sorted JSONL for stable git diffs. */
export class Frontier {
  private constructor(
    private readonly path: string,
    private readonly entries: Map<SourceUrl, FrontierEntry>,
  ) {}

  static async load(path: string): Promise<Frontier> {
    const rows = await readJsonl(path, FrontierEntry);
    return new Frontier(path, new Map(rows.map((row) => [row.url, row])));
  }

  /** Add a URL if it is new. Returns true when it was added. */
  add(url: SourceUrl, discoveredFrom?: SourceUrl, now = new Date()): boolean {
    if (this.entries.has(url)) return false;
    this.entries.set(url, {
      url,
      status: "pending",
      discoveredAt: now.toISOString(),
      ...(discoveredFrom ? { discoveredFrom } : {}),
      attempts: 0,
    });
    return true;
  }

  get(url: SourceUrl): FrontierEntry | undefined {
    return this.entries.get(url);
  }

  update(entry: FrontierEntry): void {
    this.entries.set(entry.url, FrontierEntry.parse(entry));
  }

  /** Entries with a status: highest-priority section first, then fewest attempts, then URL. */
  byPriority(status: FrontierEntry["status"]): FrontierEntry[] {
    return [...this.entries.values()]
      .filter((e) => e.status === status)
      .map((e) => ({ e, p: crawlPriority(e.url) }))
      .sort((a, b) => a.p - b.p || a.e.attempts - b.e.attempts || a.e.url.localeCompare(b.e.url))
      .map(({ e }) => e);
  }

  /** Next pending URLs to crawl. */
  next(limit: number): FrontierEntry[] {
    return this.byPriority("pending").slice(0, limit);
  }

  count(status?: FrontierEntry["status"]): number {
    if (!status) return this.entries.size;
    let n = 0;
    for (const e of this.entries.values()) if (e.status === status) n++;
    return n;
  }

  async save(): Promise<void> {
    const rows = [...this.entries.values()].sort((a, b) => a.url.localeCompare(b.url));
    await writeJsonl(this.path, rows);
  }
}
