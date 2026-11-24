import { readFileSync } from "node:fs";
import { EXTRACTION_VERSION } from "@tuttemuj/schema";
import { expect, it } from "vitest";

const skillFile = new URL("../../../../.claude/skills/extract-pages/SKILL.md", import.meta.url);

/** The `version:` line in the skill's frontmatter (the block between the first two `---` lines). */
const skillVersion = (markdown: string): number | undefined => {
  const frontmatter = /^---\n([\s\S]*?)\n---/.exec(markdown)?.[1] ?? "";
  const match = /^version:\s*(\d+)\s*$/m.exec(frontmatter);
  return match?.[1] ? Number(match[1]) : undefined;
};

it("the extract-pages skill version equals EXTRACTION_VERSION", () => {
  expect(skillVersion(readFileSync(skillFile, "utf8"))).toBe(EXTRACTION_VERSION);
});

it("docs/extraction-versions.md describes the current version", () => {
  const doc = readFileSync(
    new URL("../../../../docs/extraction-versions.md", import.meta.url),
    "utf8",
  );
  expect(doc).toContain(`### ${EXTRACTION_VERSION}`);
});
