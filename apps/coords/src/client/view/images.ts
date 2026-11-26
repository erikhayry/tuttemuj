import type { CoordsImage } from "@tuttemuj/schema";
import type { Html } from "foldkit/html";
import type { H } from "./shared.ts";

const LABELS: Record<CoordsImage["match"], string> = {
  image: "Shows this place",
  page: "Page about this place",
  mention: "Page mentions it",
};

// Images are loaded straight from nykarlebyvyer.nu and each links to its page; never rehosted.
export const imagesView = (h: H, images: ReadonlyArray<CoordsImage>): Html =>
  images.length === 0
    ? h.p([h.Class("muted")], ["No images for this place."])
    : h.ul(
        [h.Class("images")],
        images.map((image) =>
          // `keyed` ties each element to its URL, like React's `key`, so a new place never shows an
          // old picture while the new one loads.
          h.keyed("li")(image.url, image.panorama ? [h.Class("panorama")] : [], [
            h.a(
              [h.Href(image.pageUrl), h.Target("_blank"), h.Rel("noopener"), h.Class("figure")],
              [
                h.img([h.Src(image.url), h.Alt(image.alt ?? image.pageTitle), h.Loading("lazy")]),
                h.span([h.Class("figure-label")], [LABELS[image.match]]),
                h.span([], [image.pageTitle]),
              ],
            ),
          ]),
        ),
      );
