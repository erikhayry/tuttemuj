import { describe, expect, it } from "vitest";
import { personLabel } from "./retrieve.ts";

const p = (extra: Partial<Parameters<typeof personLabel>[0]> = {}) => ({
  name: "Lars Pensar",
  birth_year: null,
  death_year: null,
  roles: [],
  ...extra,
});

describe("personLabel", () => {
  it("is just the name when the page states nothing more", () => {
    expect(personLabel(p())).toBe("Lars Pensar");
  });

  it("adds years and roles when stated", () => {
    expect(
      personLabel(p({ birth_year: 1850, death_year: 1920, roles: ["rådman", "handlare"] })),
    ).toBe("Lars Pensar (1850–1920, rådman, handlare)");
  });

  it("says born or died when only one year is stated, and never invents the other", () => {
    expect(personLabel(p({ birth_year: 1850 }))).toBe("Lars Pensar (född 1850)");
    expect(personLabel(p({ death_year: 1920 }))).toBe("Lars Pensar (död 1920)");
  });
});
