import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

/** TypeSafe's limits (docs.typesafe.ai/images): each side 280–1568 px. Images are not resized for us. */
const MIN_SIDE = 280;
const MAX_SIDE = 1568;

const size = async (file: string) => {
  const { stdout } = await run("sips", ["-g", "pixelWidth", "-g", "pixelHeight", file]);
  return {
    w: Number(/pixelWidth: (\d+)/.exec(stdout)?.[1]),
    h: Number(/pixelHeight: (\d+)/.exec(stdout)?.[1]),
  };
};

/**
 * Convert an image to a JPEG within TypeSafe's size limits, using macOS `sips` (the nightly job runs
 * on a Mac). Too big: scaled down. Too small: scaled up. Too thin after that (a panorama): padded
 * with white, so the whole picture is kept.
 */
export async function prepareImage(src: string, out: string): Promise<void> {
  await run("sips", ["-s", "format", "jpeg", src, "--out", out]);
  let { w, h } = await size(out);
  if (!w || !h) throw new Error("could not read image size");
  if (Math.max(w, h) > MAX_SIDE) await run("sips", ["-Z", String(MAX_SIDE), out]);
  else if (Math.max(w, h) < MIN_SIDE) await run("sips", ["-Z", String(MIN_SIDE), out]);
  ({ w, h } = await size(out));
  if (Math.min(w, h) < MIN_SIDE) {
    const args = [String(Math.max(h, MIN_SIDE)), String(Math.max(w, MIN_SIDE))];
    await run("sips", ["--padToHeightWidth", ...args, "--padColor", "FFFFFF", out]);
  }
}
