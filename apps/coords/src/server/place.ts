// What the page shows about one place: where it is mentioned, and the images on those pages.
import {
  type CoordsImage,
  type CoordsPlace,
  isDecorativeImage,
  normalizeName,
  type PageExtraction,
  SOURCE_ORIGIN,
  SourceUrl,
} from "@tuttemuj/schema";
import { Schema } from "effect";
import type { Data } from "./data.ts";

const MAX_CONTEXT = 5;
const MAX_IMAGES = 24;
const PANORAMA_RATIO = 2.5;
/** A long page that only mentions the place must not fill the whole grid. */
const MAX_PER_MENTION_PAGE = 3;

type Ranked = Data["ranked"][number];

export const describePlace = (data: Data, ranked: Ranked): CoordsPlace => {
  const entry = data.entries.get(ranked.name);
  if (!entry) throw new Error(`No gazetteer entry for ${ranked.name}`);
  const names = new Set([entry.name, ...(entry.alternateNames ?? [])].map(normalizeName));
  const isPlace = (name: string) => names.has(normalizeName(name));
  const inTitle = (page: PageExtraction) => {
    const title = normalizeName(page.title);
    return [...names].some((n) => title.includes(n));
  };
  const mentions = (page: PageExtraction) =>
    page.places.filter((p) => [p.name, ...p.alternateNames].some(isPlace));

  // Best pages first: named after the place, then saying something about it, then the ones that
  // mention few other places.
  const score = (page: PageExtraction) =>
    inTitle(page) ? 0 : mentions(page).some((p) => p.description || p.address) ? 1 : 2;
  const pages = ranked.pages
    .flatMap((path) => {
      const url = Schema.decodeUnknownSync(SourceUrl)(`${SOURCE_ORIGIN}/${path}`);
      return data.pages.get(url) ?? [];
    })
    .sort((a, b) => score(a) - score(b) || a.places.length - b.places.length);

  const context = pages.slice(0, MAX_CONTEXT).map((page) => {
    const found = mentions(page);
    const address = found.find((p) => p.address)?.address;
    return {
      sourceUrl: page.sourceUrl,
      title: page.title,
      text: found.find((p) => p.description)?.description ?? page.summary,
      ...(address ? { address } : {}),
    };
  });

  const images = pages.flatMap((page) =>
    (data.images.get(page.sourceUrl) ?? []).flatMap((image, i) => {
      if (isDecorativeImage(image) || data.unusable.has(image.url)) return [];
      // `ImageFact.image` counts from 1, in the same order as the frontier's list.
      const tagged = page.images?.find((f) => f.image === i + 1)?.places ?? [];
      const match: CoordsImage["match"] = tagged.some(isPlace)
        ? "image"
        : inTitle(page)
          ? "page"
          : "mention";
      // An image the page ties to another place goes last: it probably shows that one.
      const order = match === "image" ? 0 : tagged.length > 0 ? 3 : match === "page" ? 1 : 2;
      return [
        {
          order,
          image: {
            url: image.url,
            pageUrl: page.sourceUrl,
            pageTitle: page.title,
            ...(image.alt ? { alt: image.alt } : {}),
            panorama: image.width > image.height * PANORAMA_RATIO,
            match,
          },
        },
      ];
    }),
  );
  // `sort` is stable, so within one `order` the best pages stay first.
  const shown = new Map<string, number>();
  const best = images
    .sort((a, b) => a.order - b.order)
    .map((i) => i.image)
    .filter((image) => {
      if (image.match !== "mention") return true;
      const count = (shown.get(image.pageUrl) ?? 0) + 1;
      shown.set(image.pageUrl, count);
      return count <= MAX_PER_MENTION_PAGE;
    });

  return {
    name: entry.name,
    kind: entry.kind,
    alternateNames: entry.alternateNames ?? [],
    ...(entry.note ? { note: entry.note } : {}),
    pageCount: ranked.pageCount,
    context,
    images: [...new Map(best.map((i) => [i.url, i])).values()].slice(0, MAX_IMAGES),
  };
};
