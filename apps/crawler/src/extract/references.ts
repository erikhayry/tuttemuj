import type { ImageFact, PersonPlaceRelation } from "@tuttemuj/schema";

/**
 * Problems in the v1 fields of a draft: a relation or an image that names a person or place the
 * page does not have, or an image number that does not exist. Shared by `extract:save` (full
 * drafts) and `enrich:save` (add-on drafts), so both fail the same way and the analyst can fix it.
 */
export function referenceErrors(
  known: { people: Iterable<string>; places: Iterable<string> },
  v1: { relations: readonly PersonPlaceRelation[]; images: readonly ImageFact[] },
  imageCount: number,
): string[] {
  const people = new Set(known.people);
  const places = new Set(known.places);
  const errors: string[] = [];
  for (const [i, r] of v1.relations.entries()) {
    if (!people.has(r.person))
      errors.push(`relations[${i}]: "${r.person}" is not in the page's people`);
    if (!places.has(r.place))
      errors.push(`relations[${i}]: "${r.place}" is not in the page's places`);
  }
  const seen = new Set<number>();
  for (const [i, im] of v1.images.entries()) {
    if (im.image > imageCount)
      errors.push(`images[${i}]: [bild ${im.image}] does not exist (${imageCount} images)`);
    if (seen.has(im.image)) errors.push(`images[${i}]: [bild ${im.image}] is listed twice`);
    seen.add(im.image);
    for (const name of im.places)
      if (!places.has(name)) errors.push(`images[${i}]: "${name}" is not in the page's places`);
  }
  return errors;
}
