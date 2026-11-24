import { type MessageKey, message as t } from "@tuttemuj/messages";
import {
  ButtonId,
  type ButtonResult,
  ButtonResultsResponse,
  ButtonsResponse,
  type Lang,
} from "@tuttemuj/schema";
import { Effect, Match, Schema } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";
import { AsyncData, Command, Http, type Runtime, type Update } from "foldkit";
import type { Document, Html, HtmlBuilder } from "foldkit/html";
import { defineMessageUnion } from "foldkit/message";
import { modifyFields } from "foldkit/struct";

// MODEL
// The app is a few steps: find the position, load the buttons that have results there, then load
// the results of one button. Each step is an `AsyncData` (Idle, Loading, Success, Failure): like the
// `{ data, isLoading, error }` of React Query, but as one value that cannot be in two states at once.

const Position = Schema.Struct({ lat: Schema.Number, lng: Schema.Number });
type Position = typeof Position.Type;

/** Why the position failed. An id, not text: the view turns it into a message in the user's language. */
const LocateError = Schema.Literals(["denied", "unavailable"]);

/** The API could not be reached or answered badly. */
const ApiError = Schema.Literal("api");

const PositionData = AsyncData.Schema(Position, LocateError);
const ButtonsData = AsyncData.Schema(ButtonsResponse, ApiError);
const ResultsData = AsyncData.Schema(ButtonResultsResponse, ApiError);

export const Model = Schema.Struct({
  lang: Schema.Literals(["sv", "fi", "en"]),
  position: PositionData.schema,
  buttons: ButtonsData.schema,
  /** The button the user opened, if any. */
  selected: Schema.NullOr(ButtonId),
  results: ResultsData.schema,
});
export type Model = typeof Model.Type;

// MESSAGE
// Everything that can happen. The view and the Commands send these; `update` is the only place that
// reacts to them.

export const Message = defineMessageUnion({
  ClickedLocate: {},
  SucceededLocate: { position: Position },
  FailedLocate: { reason: LocateError },
  SucceededLoadButtons: { response: ButtonsResponse },
  FailedLoadButtons: {},
  ClickedButton: { id: ButtonId },
  SucceededLoadResults: { response: ButtonResultsResponse },
  FailedLoadResults: {},
  ClickedBack: {},
});
export type Message = typeof Message.Type;

// UPDATE
// `update(model, message)` returns the next model plus Commands to run. A Command is a side effect
// (asking the browser, calling the API) described as data; Foldkit runs it and sends back a Message.

export const update = (model: Model, message: Message) =>
  Message.match<Update.Return<Model, Message>>(message, {
    ClickedLocate: () => ({
      model: modifyFields(model, { position: () => PositionData.Loading() }),
      commands: [Locate()],
    }),

    SucceededLocate: ({ position }) => ({
      model: modifyFields(model, {
        position: () => PositionData.Success({ data: position }),
        buttons: () => ButtonsData.Loading(),
        selected: () => null,
        results: () => ResultsData.Idle(),
      }),
      commands: [LoadButtons(position)],
    }),

    FailedLocate: ({ reason }) => ({
      model: modifyFields(model, { position: () => PositionData.Failure({ error: reason }) }),
    }),

    SucceededLoadButtons: ({ response }) => ({
      model: modifyFields(model, { buttons: () => ButtonsData.Success({ data: response }) }),
    }),

    FailedLoadButtons: () => ({
      model: modifyFields(model, { buttons: () => ButtonsData.Failure({ error: "api" }) }),
    }),

    ClickedButton: ({ id }) => {
      // Results need a position; the buttons only show once there is one.
      if (!AsyncData.isSuccess(model.position)) return { model };
      return {
        model: modifyFields(model, {
          selected: () => id,
          results: () => ResultsData.Loading(),
        }),
        commands: [LoadResults({ id, ...model.position.data })],
      };
    },

    SucceededLoadResults: ({ response }) => ({
      model: modifyFields(model, { results: () => ResultsData.Success({ data: response }) }),
    }),

    FailedLoadResults: () => ({
      model: modifyFields(model, { results: () => ResultsData.Failure({ error: "api" }) }),
    }),

    ClickedBack: () => ({
      model: modifyFields(model, {
        selected: () => null,
        results: () => ResultsData.Idle(),
      }),
    }),
  });

// INIT

export const init: Runtime.ApplicationInit<Model, Message> = () => ({
  model: {
    lang: "sv",
    position: PositionData.Idle(),
    buttons: ButtonsData.Idle(),
    selected: null,
    results: ResultsData.Idle(),
  },
});

// COMMANDS

/** Ask the browser for the position. The browser shows its own permission prompt. */
export const Locate = Command.define("Locate", {
  messages: [Message.SucceededLocate, Message.FailedLocate],
  // `Effect.callback` wraps a callback API (here `getCurrentPosition`) as an Effect, like `new Promise`.
  execute: Effect.callback<
    ReturnType<typeof Message.SucceededLocate> | ReturnType<typeof Message.FailedLocate>
  >((resume) => {
    if (!navigator.geolocation) {
      resume(Effect.succeed(Message.FailedLocate({ reason: "unavailable" })));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resume(
          Effect.succeed(
            Message.SucceededLocate({
              position: { lat: p.coords.latitude, lng: p.coords.longitude },
            }),
          ),
        ),
      (e) =>
        resume(
          Effect.succeed(
            Message.FailedLocate({
              // PERMISSION_DENIED is code 1; timeouts and "no position" are "unavailable".
              reason: e.code === e.PERMISSION_DENIED ? "denied" : "unavailable",
            }),
          ),
        ),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  }),
});

// The API is the Effect server in apps/api (`/api` is forwarded to it, see vite.config.ts).
const API = "/api";

/** GET a path and check the answer with a Schema: the same one the server used to build it. */
const getJson = <A, I>(path: string, params: Record<string, string>, schema: Schema.Codec<A, I>) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    const response = yield* client.execute(
      HttpClientRequest.get(`${API}${path}`).pipe(HttpClientRequest.setUrlParams(params)),
    );
    if (response.status !== 200) return yield* Effect.fail(new Error(`HTTP ${response.status}`));
    return yield* Schema.decodeUnknownEffect(schema)(yield* response.json);
  });

const positionParams = ({ lat, lng }: Position) => ({ lat: String(lat), lng: String(lng) });

export const LoadButtons = Command.define("LoadButtons", {
  args: { lat: Schema.Number, lng: Schema.Number },
  messages: [Message.SucceededLoadButtons, Message.FailedLoadButtons],
  execute: (position) =>
    getJson("/buttons", { ...positionParams(position), radius: "200" }, ButtonsResponse).pipe(
      // The API answers 400 for a position outside Nykarleby. For the user that is simply "nothing
      // here", not an error, so it becomes an empty list of buttons.
      Effect.catchIf(
        (e) => e instanceof Error && e.message === "HTTP 400",
        () => Effect.succeed({ buttons: [] }),
      ),
      Effect.map((response) => Message.SucceededLoadButtons({ response })),
      Effect.catch(() => Effect.succeed(Message.FailedLoadButtons())),
      Effect.provide(Http.layer),
    ),
});

export const LoadResults = Command.define("LoadResults", {
  args: { id: ButtonId, lat: Schema.Number, lng: Schema.Number },
  messages: [Message.SucceededLoadResults, Message.FailedLoadResults],
  execute: ({ id, ...position }) =>
    getJson(
      `/buttons/${id}`,
      { ...positionParams(position), radius: "200" },
      ButtonResultsResponse,
    ).pipe(
      Effect.map((response) => Message.SucceededLoadResults({ response })),
      Effect.catch(() => Effect.succeed(Message.FailedLoadResults())),
      Effect.provide(Http.layer),
    ),
});

// VIEW
// All visible text goes through `t(lang, key)`, so nothing in this file is hard-coded Swedish.

type H = HtmlBuilder<Message>;

const buttonKey = (id: ButtonId): MessageKey => `buttons.${id}.label`;

const card = "rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200";
const primary =
  "w-full rounded-xl bg-orange-900 px-4 py-3 text-left text-base font-medium text-white active:bg-orange-950";

/** Every answer links to the page it comes from. */
const sourceLink = (lang: Lang, h: H, url: string, title?: string): Html =>
  h.a(
    [
      h.Href(url),
      h.Target("_blank"),
      h.Rel("noopener"),
      h.Class("mt-2 inline-block text-sm text-orange-900 underline"),
    ],
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

const resultView = (lang: Lang, h: H, r: ButtonResult): Html => {
  const { heading, body } = resultLines(lang, r);
  const place = r.button === "nearby" ? "" : r.placeName;
  return h.li(
    [h.Class(card)],
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
                  h.Class("mb-2 w-full rounded-lg"),
                ]),
              ],
            ),
          ]
        : []),
      h.p([h.Class("font-medium text-stone-900")], [heading]),
      ...(body ? [h.p([h.Class("mt-1 text-sm text-stone-700")], [body])] : []),
      ...(place
        ? [
            h.p(
              [h.Class("mt-1 text-xs text-stone-500")],
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

const message = (lang: Lang, h: H, key: MessageKey, extra: ReadonlyArray<Html> = []): Html =>
  h.div([h.Class(`${card} text-stone-800`)], [h.p([], [t(lang, key)]), ...extra]);

const locateButton = (lang: Lang, h: H, key: MessageKey): Html =>
  h.button([h.OnClick(Message.ClickedLocate()), h.Class(primary)], [t(lang, key)]);

const resultsView = (model: Model, h: H): Html => {
  const { lang } = model;
  return h.section(
    [h.Class("flex flex-col gap-3")],
    [
      h.button(
        [h.OnClick(Message.ClickedBack()), h.Class("self-start text-sm text-orange-900 underline")],
        [`← ${t(lang, "nav.back")}`],
      ),
      h.h2(
        [h.Class("text-xl font-semibold text-stone-900")],
        [model.selected ? t(lang, buttonKey(model.selected)) : ""],
      ),
      AsyncData.matchDataSplitEmpty(model.results, {
        onIdle: () => h.empty,
        onLoading: () => h.p([h.Class("text-stone-600")], [t(lang, "status.loading")]),
        onFailure: () => message(lang, h, "status.error"),
        onData: (data) =>
          data.results.length === 0
            ? message(lang, h, "results.empty")
            : h.ul(
                [h.Class("flex flex-col gap-3")],
                data.results.map((r) => resultView(lang, h, r)),
              ),
      }),
    ],
  );
};

const buttonsView = (model: Model, h: H): Html => {
  const { lang } = model;
  return AsyncData.matchDataSplitEmpty(model.buttons, {
    onIdle: () => h.empty,
    onLoading: () => h.p([h.Class("text-stone-600")], [t(lang, "status.loading")]),
    onFailure: () => message(lang, h, "status.error", [locateButton(lang, h, "location.retry")]),
    onData: (data) =>
      data.buttons.length === 0
        ? message(lang, h, "status.nothing-here")
        : h.ul(
            [h.Class("flex flex-col gap-3")],
            data.buttons.map((b) =>
              h.li(
                [],
                [
                  h.button(
                    [h.OnClick(Message.ClickedButton({ id: b.button })), h.Class(primary)],
                    [t(lang, buttonKey(b.button))],
                  ),
                ],
              ),
            ),
          ),
  });
};

/** What to show under the heading, depending on where we are. */
const body = (model: Model, h: H): Html => {
  const { lang } = model;
  if (model.selected) return resultsView(model, h);
  return AsyncData.matchDataSplitEmpty(model.position, {
    onIdle: () =>
      message(lang, h, "location.explain", [
        h.div([h.Class("mt-3")], [locateButton(lang, h, "location.allow")]),
      ]),
    onLoading: () => h.p([h.Class("text-stone-600")], [t(lang, "status.loading")]),
    onFailure: (reason) =>
      message(lang, h, reason === "denied" ? "location.denied.help" : "location.unavailable", [
        h.div([h.Class("mt-3")], [locateButton(lang, h, "location.retry")]),
      ]),
    onData: () => buttonsView(model, h),
  });
};

export const view = (model: Model, h: H): Document => ({
  title: t(model.lang, "app.title"),
  body: h.main(
    [h.Class("mx-auto flex min-h-screen max-w-md flex-col gap-4 bg-stone-50 p-4 pb-12")],
    [
      h.header(
        [],
        [
          h.h1([h.Class("text-3xl font-bold text-orange-900")], [t(model.lang, "app.title")]),
          h.p([h.Class("text-sm text-stone-600")], [t(model.lang, "app.tagline")]),
        ],
      ),
      body(model, h),
    ],
  ),
});
