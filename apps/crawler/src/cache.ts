import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { SourceUrl } from "@tuttemuj/schema";

/**
 * Local-only cache of fetched pages (gitignored), mirroring the site's paths.
 * Lets extraction be re-run without fetching from the source again.
 */
export class PageCache {
  constructor(private readonly dir: string) {}

  pathFor(url: SourceUrl): string {
    return join(this.dir, "pages", new URL(url).pathname);
  }

  async write(url: SourceUrl, html: string): Promise<void> {
    const path = this.pathFor(url);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, html, "utf8");
  }

  async read(url: SourceUrl): Promise<string | undefined> {
    try {
      return await readFile(this.pathFor(url), "utf8");
    } catch {
      return undefined;
    }
  }
}
