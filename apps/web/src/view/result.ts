import { message as t } from "@tuttemuj/messages";
import type { ButtonResult, Lang } from "@tuttemuj/schema";
import { Match } from "effect";
import type { Html } from "foldkit/html";
import type { H } from "./shared.ts";

/** Every answer links to the page it comes from. */
const sourceLink = (lang: Lang, h: H, url: string, title?: string): Html =>
  h.a(
    [h.Href(url), h.Target("_blank"), h.Rel("noopener"), h.Class("source-link")],
    [title ? t(lang, "source.from", { title }) : t(lang, "source.read-more")],
  );

const yearText = (lang: Lang, year: number | undefined, circa = false): string =>
  year === undefined ? "" : t(lang, circa ? "year.circa" : "year.single", { year });

const spanText = (lang: Lang, start?: number, end?: number): string =>
  start !== undefined && end !== undefined
    ? t(lang, "years.range", { start, end })
    : start !== undefined
      ? t(lang, "years.from", { start })
      : end !== undefined
        ? t(lang, "years.until", { end })
        : "";

/** The text of one result; each kind of result has its own shape. */
const resultLines = (lang: Lang, r: ButtonResult): { heading: string; body: string } =>
  Match.value(r).pipe(
    Match.discriminatorsExhaustive("button")({
      "who-lived-here": (r) => ({
        heading: r.personName,
        body: [t(lang, `relation.${r.relation}`), spanText(lang, r.startYear, r.endYear)]
          .filter(Boolean)
          .join(" · "),
      }),
      "what-happened-here": (r) => ({
        heading: [yearText(lang, r.year, r.circa), r.title].filter(Boolean).join(" – "),
        body: r.description ?? "",
      }),
      "stories-from-here": (r) => ({ heading: r.pageTitle, body: r.summary }),
      "old-images-from-here": (r) => ({ heading: r.pageTitle, body: yearText(lang, r.year) }),
      "old-maps": (r) => ({ heading: r.pageTitle, body: r.summary }),
      "what-was-here": (r) => ({
        heading: r.use,
        body: spanText(lang, r.startYear, r.endYear),
      }),
      "who-worked-here": (r) => ({
        heading: r.personName ?? r.use ?? r.pageTitle,
        body: [
          r.relation ? t(lang, `relation.${r.relation}`) : "",
          spanText(lang, r.startYear, r.endYear),
        ]
          .filter(Boolean)
          .join(" · "),
      }),
      "why-the-name": (r) => ({ heading: r.placeName, body: r.nameOrigin }),
      "on-this-day": (r) => ({
        heading: [yearText(lang, r.year, r.circa), r.title].filter(Boolean).join(" – "),
        body: r.description ?? "",
      }),
      nearby: (r) => ({
        heading: r.placeName,
        body: t(lang, "distance.metres", { distance: r.distanceM }),
      }),
    }),
  );

export const resultView = (lang: Lang, h: H, r: ButtonResult): Html => {
  const { heading, body } = resultLines(lang, r);
  const place = r.button === "nearby" ? "" : r.placeName;
  return h.li(
    [h.Class("card")],
    [
      // Old images are loaded from nykarlebyvyer.nu and link to their page; they are never rehosted.
      ...(r.button === "old-images-from-here"
        ? [
            h.a(
              [h.Href(r.sourceUrl), h.Target("_blank"), h.Rel("noopener")],
              [
                h.img([
                  h.Src(r.imageUrl),
                  h.Alt(t(lang, "image.alt", { place: r.placeName })),
                  h.Loading("lazy"),
                  h.Class("result-image"),
                ]),
              ],
            ),
          ]
        : []),
      h.p([h.Class("result-title")], [heading]),
      ...(body ? [h.p([h.Class("result-body")], [body])] : []),
      ...(place
        ? [
            h.p(
              [h.Class("result-meta")],
              [`${place} · ${t(lang, "distance.metres", { distance: r.distanceM })}`],
            ),
          ]
        : []),
      ...("sourceUrl" in r
        ? [sourceLink(lang, h, r.sourceUrl, "pageTitle" in r ? r.pageTitle : undefined)]
        : []),
    ],
  );
};
