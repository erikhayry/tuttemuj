import {
  type ButtonId,
  type ButtonQuery,
  type ButtonResult,
  GazetteerKind,
  PersonPlaceRelationKind,
  SourceUrl,
} from "@tuttemuj/schema";
import { Schema } from "effect";

// Each button is one Postgres function (supabase/migrations/20261124230000_button_queries.sql). This
// file says how to call it and how to turn its rows (snake_case, nulls) into API results
// (camelCase, optional keys). The rows are checked with a Schema at this boundary, so a change in
// the database that the API does not know about fails loudly instead of sending bad data.

/** A database `null` becomes a missing key, as the API schemas expect. */
const opt = <K extends string, V>(key: K, value: V | null): { [P in K]?: V } =>
  value === null ? {} : ({ [key]: value } as { [P in K]?: V });

const Place = {
  place_id: Schema.String,
  place_name: Schema.String,
  distance_m: Schema.Number,
};
const Source = { source_url: SourceUrl, page_title: Schema.String };
const TitledSource = { source_url: SourceUrl, title: Schema.String };
const NullInt = Schema.NullOr(Schema.Int);

type Place = { place_id: string; place_name: string; distance_m: number };
type Source = { source_url: string; page_title: string };
const place = (r: Place) => ({
  placeId: r.place_id,
  placeName: r.place_name,
  distanceM: Math.round(r.distance_m),
});
const source = (r: Source) => ({ sourceUrl: r.source_url as SourceUrl, pageTitle: r.page_title });

const titledSource = (r: { source_url: string; title: string }) => ({
  sourceUrl: r.source_url as SourceUrl,
  pageTitle: r.title,
});

/** What a button needs: the function to call, the row it returns, and the result it becomes. */
// `Schema.Codec<A, I>` is a schema that needs no extra services to decode, so decoding rows has no
// hidden requirements (a plain `Schema.Top` would leave an `unknown` requirement on the handlers).
// biome-ignore lint/suspicious/noExplicitAny: the row types differ per button
type AnyCodec = Schema.Codec<any, any>;
type Spec<S extends AnyCodec = AnyCodec> = {
  readonly fn: string;
  readonly row: S;
  readonly map: (row: S["Type"]) => ButtonResult;
};
// A helper so each spec below is checked against its own row type.
const spec = <S extends AnyCodec>(s: Spec<S>): Spec => s as unknown as Spec;

export const BUTTONS: Record<ButtonId, Spec> = {
  "who-lived-here": spec({
    fn: "button_who_lived_here",
    row: Schema.Struct({
      ...Place,
      ...Source,
      person_name: Schema.String,
      relation: PersonPlaceRelationKind,
      start_year: NullInt,
      end_year: NullInt,
    }),
    map: (r) => ({
      button: "who-lived-here",
      ...place(r),
      ...source(r),
      personName: r.person_name,
      relation: r.relation,
      ...opt("startYear", r.start_year),
      ...opt("endYear", r.end_year),
    }),
  }),
  "what-happened-here": spec({
    fn: "button_what_happened_here",
    row: Schema.Struct({
      ...Place,
      ...Source,
      event_id: Schema.String,
      title: Schema.String,
      year: NullInt,
      month: NullInt,
      day: NullInt,
      end_year: NullInt,
      circa: Schema.Boolean,
      description: Schema.NullOr(Schema.String),
    }),
    map: (r) => ({
      button: "what-happened-here",
      ...place(r),
      ...source(r),
      eventId: r.event_id,
      title: r.title,
      ...opt("year", r.year),
      ...opt("month", r.month),
      ...opt("day", r.day),
      ...opt("endYear", r.end_year),
      circa: r.circa,
      ...opt("description", r.description),
    }),
  }),
  "stories-from-here": spec({
    fn: "button_stories_from_here",
    // These two functions name the page title column `title`, not `page_title`.
    row: Schema.Struct({ ...Place, ...TitledSource, summary: Schema.String }),
    map: (r) => ({
      button: "stories-from-here",
      ...place(r),
      ...titledSource(r),
      summary: r.summary,
    }),
  }),
  "old-images-from-here": spec({
    fn: "button_old_images_from_here",
    row: Schema.Struct({ ...Place, ...Source, image_url: SourceUrl, year: NullInt }),
    map: (r) => ({
      button: "old-images-from-here",
      ...place(r),
      ...source(r),
      imageUrl: r.image_url,
      ...opt("year", r.year),
    }),
  }),
  "old-maps": spec({
    fn: "button_old_maps",
    row: Schema.Struct({ ...Place, ...TitledSource, summary: Schema.String }),
    map: (r) => ({ button: "old-maps", ...place(r), ...titledSource(r), summary: r.summary }),
  }),
  "what-was-here": spec({
    fn: "button_what_was_here",
    row: Schema.Struct({
      ...Place,
      ...Source,
      use: Schema.String,
      start_year: NullInt,
      end_year: NullInt,
    }),
    map: (r) => ({
      button: "what-was-here",
      ...place(r),
      ...source(r),
      use: r.use,
      ...opt("startYear", r.start_year),
      ...opt("endYear", r.end_year),
    }),
  }),
  "who-worked-here": spec({
    fn: "button_who_worked_here",
    row: Schema.Struct({
      ...Place,
      ...Source,
      person_name: Schema.NullOr(Schema.String),
      relation: Schema.NullOr(PersonPlaceRelationKind),
      use: Schema.NullOr(Schema.String),
      start_year: NullInt,
      end_year: NullInt,
    }),
    map: (r) => ({
      button: "who-worked-here",
      ...place(r),
      ...source(r),
      ...opt("personName", r.person_name),
      ...opt("relation", r.relation),
      ...opt("use", r.use),
      ...opt("startYear", r.start_year),
      ...opt("endYear", r.end_year),
    }),
  }),
  "why-the-name": spec({
    fn: "button_why_the_name",
    row: Schema.Struct({ ...Place, ...Source, name_origin: Schema.String }),
    map: (r) => ({
      button: "why-the-name",
      ...place(r),
      ...source(r),
      nameOrigin: r.name_origin,
    }),
  }),
  "on-this-day": spec({
    fn: "button_on_this_day",
    row: Schema.Struct({
      ...Place,
      ...Source,
      event_id: Schema.String,
      title: Schema.String,
      year: NullInt,
      circa: Schema.Boolean,
      description: Schema.NullOr(Schema.String),
    }),
    map: (r) => ({
      button: "on-this-day",
      ...place(r),
      ...source(r),
      eventId: r.event_id,
      title: r.title,
      ...opt("year", r.year),
      circa: r.circa,
      ...opt("description", r.description),
    }),
  }),
  nearby: spec({
    fn: "button_nearby",
    row: Schema.Struct({
      ...Place,
      kind: GazetteerKind,
      lat: Schema.Number,
      lng: Schema.Number,
      page_count: Schema.Int,
    }),
    map: (r) => ({
      button: "nearby",
      ...place(r),
      kind: r.kind,
      lat: r.lat,
      lng: r.lng,
      pageCount: r.page_count,
    }),
  }),
};

/** The buttons in the order the app shows them. */
export const BUTTON_ORDER = Object.keys(BUTTONS) as ButtonId[];

/** Today's month and day in Finland, so "on this day" follows the town's calendar, not the server's. */
export const todayInFinland = (now: Date = new Date()): { month: number; day: number } => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Helsinki",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { month: get("month"), day: get("day") };
};

/** The arguments of a button's function. Only `on-this-day` takes a date. */
export const rpcArgs = (id: ButtonId, q: ButtonQuery, today = todayInFinland()) => ({
  in_lat: q.lat,
  in_lng: q.lng,
  in_radius_m: q.radius,
  in_limit: q.limit,
  ...(id === "on-this-day" ? { in_month: q.month ?? today.month, in_day: q.day ?? today.day } : {}),
});
