import { rename, writeFile } from "node:fs/promises";

/** Temp file + rename, so a crash never leaves a half-written file. */
export const writeAtomically = async (path: string, text: string) => {
  await writeFile(`${path}.tmp`, text);
  await rename(`${path}.tmp`, path);
};
