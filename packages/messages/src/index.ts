import { Lang } from "@tuttemuj/schema";
import { Schema } from "effect";
import { en } from "./en.ts";
import { fi } from "./fi.ts";
import { type MessageKey, sv } from "./sv.ts";

export type { MessageKey } from "./sv.ts";

const catalogs: Record<Lang, Record<MessageKey, string>> = { sv, fi, en };

/**
 * The languages the app offers. v1 is Swedish only; v1.1 adds "fi" and "en" here, once their
 * catalogs have text. This is the one list the chooser and `resolveLang` read.
 */
export const AVAILABLE_LANGS: readonly Lang[] = ["sv"];

/** Values to fill into `{name}` markers. */
export type MessageParams = Readonly<Record<string, string | number>>;

/**
 * The text for `key` in `lang`, with `{name}` markers filled from `params`. An empty or missing
 * message falls back to Swedish, so a half-translated language never shows blanks.
 */
export function message(lang: Lang, key: MessageKey, params: MessageParams = {}): string {
  const text = catalogs[lang][key] || sv[key];
  // A marker with no value is left as it is, so the gap is visible instead of silently empty.
  return text.replace(/\{(\w+)\}/g, (marker, name: string) => String(params[name] ?? marker));
}

/**
 * The one place that decides the language: the user's saved choice if it is offered, else the first
 * browser language (`navigator.languages`, like "sv-FI") that is offered, else Swedish.
 */
export function resolveLang(input: {
  /** What the user chose earlier, e.g. from localStorage. May be anything: it is checked. */
  stored?: unknown;
  /** `navigator.languages`, most preferred first. */
  browser?: readonly string[];
}): Lang {
  const offered = (value: unknown): Lang | undefined => {
    // `Schema.is` is a type guard: true only for "sv", "fi" or "en" (Zod's `.safeParse(x).success`).
    const lang = Schema.is(Lang)(value) ? value : undefined;
    return lang && AVAILABLE_LANGS.includes(lang) ? lang : undefined;
  };
  const stored = offered(input.stored);
  if (stored) return stored;
  for (const tag of input.browser ?? []) {
    const lang = offered(tag.toLowerCase().split("-")[0]);
    if (lang) return lang;
  }
  return "sv";
}
