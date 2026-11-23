/** Lowercase, single spaces, no brackets: the key used for matching place names. */
export const normalizeName = (name: string): string =>
  name
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, "")
    .replace(/[.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
