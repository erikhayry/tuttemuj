import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { z } from "zod";

export async function readJsonl<T extends z.ZodType>(
  path: string,
  schema: T,
): Promise<z.infer<T>[]> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  return raw
    .split("\n")
    .filter((line) => line.trim())
    .map((line, i) => {
      const result = schema.safeParse(JSON.parse(line));
      if (!result.success) throw new Error(`${path}:${i + 1}: ${result.error.message}`);
      return result.data;
    });
}

/** Write atomically (temp file + rename) so a crash never leaves a half-written file. */
export async function writeJsonl(path: string, rows: unknown[]): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, rows.map((row) => `${JSON.stringify(row)}\n`).join(""));
  await rename(tmp, path);
}

export async function appendJsonl(path: string, row: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(row)}\n`);
}
