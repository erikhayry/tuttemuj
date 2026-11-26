import type { CoordsPlace } from "@tuttemuj/schema";
import type { Html } from "foldkit/html";
import type { Model } from "../model.ts";
import { coordsForm } from "./form.ts";
import { imagesView } from "./images.ts";
import { externalLink, type H } from "./shared.ts";

const mapsSearch = (query: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${query} Nykarleby`)}`;

export const placeView = (model: Model, h: H, place: CoordsPlace): Html => {
  const addresses = [...new Set(place.context.flatMap((c) => c.address ?? []))];
  return h.article(
    [h.Class("place")],
    [
      h.section(
        [h.Class("card")],
        [
          h.h2([h.Class("place-name")], [place.name]),
          h.p([h.Class("muted")], [`${place.kind} · ${place.pageCount} pages`]),
          ...(place.alternateNames.length > 0
            ? [h.p([], [`Also called: ${place.alternateNames.join(", ")}`])]
            : []),
          ...(place.note ? [h.p([], [place.note])] : []),
          h.p(
            [h.Class("map-links")],
            [place.name, ...addresses].map((query) =>
              externalLink(h, mapsSearch(query), `Search Maps: ${query}`),
            ),
          ),
          coordsForm(model, h),
        ],
      ),
      h.ul(
        [h.Class("context")],
        place.context.map((c) =>
          h.li(
            [],
            [
              externalLink(h, c.sourceUrl, c.title),
              h.p([], [c.address ? `${c.address} · ${c.text}` : c.text]),
            ],
          ),
        ),
      ),
      imagesView(h, place.images),
    ],
  );
};
