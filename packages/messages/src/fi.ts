import type { MessageKey } from "./sv.ts";

/**
 * Finnish messages. Empty for now (v1.1): an empty message falls back to Swedish.
 *
 * `Record<MessageKey, string>` means TypeScript checks that this file has exactly the keys of
 * sv.ts, no missing ones and no extras (like a Zod object schema with `.strict()`, but at build
 * time). So a new Swedish message cannot be forgotten here.
 */
export const fi: Record<MessageKey, string> = {
  "app.title": "",
  "app.tagline": "",
  "buttons.who-lived-here.label": "",
  "buttons.what-happened-here.label": "",
  "buttons.stories-from-here.label": "",
  "buttons.old-images-from-here.label": "",
  "buttons.old-maps.label": "",
  "buttons.what-was-here.label": "",
  "buttons.who-worked-here.label": "",
  "buttons.why-the-name.label": "",
  "buttons.on-this-day.label": "",
  "buttons.nearby.label": "",
  "location.explain": "",
  "location.allow": "",
  "location.denied.title": "",
  "location.denied.help": "",
  "location.unavailable": "",
  "location.retry": "",
  "status.loading": "",
  "status.error": "",
  "status.nothing-here": "",
  "results.empty": "",
  "nav.back": "",
  "source.read-more": "",
  "source.from": "",
  "image.alt": "",
  "distance.metres": "",
  "year.single": "",
  "year.circa": "",
  "years.range": "",
  "years.from": "",
  "years.until": "",
  "relation.lived": "",
  "relation.owned": "",
  "relation.built": "",
  "relation.ran": "",
  "relation.worked": "",
  "relation.born": "",
  "relation.died": "",
  "lang.sv": "",
  "lang.fi": "",
  "lang.en": "",
};
