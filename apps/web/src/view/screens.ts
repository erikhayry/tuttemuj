import { message as t } from "@tuttemuj/messages";
import { AsyncData } from "foldkit";
import type { Html } from "foldkit/html";
import { Message } from "../message.ts";
import type { Model } from "../model.ts";
import { resultView } from "./result.ts";
import { buttonKey, type H, locateButton, notice } from "./shared.ts";

const resultsView = (model: Model, h: H): Html => {
  const { lang } = model;
  return h.section(
    [h.Class("stack")],
    [
      h.button(
        [h.OnClick(Message.ClickedBack()), h.Class("link-button")],
        [`← ${t(lang, "nav.back")}`],
      ),
      h.h2([h.Class("section-title")], [model.selected ? t(lang, buttonKey(model.selected)) : ""]),
      AsyncData.matchDataSplitEmpty(model.results, {
        onIdle: () => h.empty,
        onLoading: () => h.p([h.Class("muted")], [t(lang, "status.loading")]),
        onFailure: () => notice(lang, h, "status.error"),
        onData: (data) =>
          data.results.length === 0
            ? notice(lang, h, "results.empty")
            : h.ul(
                [h.Class("stack")],
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
    onLoading: () => h.p([h.Class("muted")], [t(lang, "status.loading")]),
    onFailure: () => notice(lang, h, "status.error", [locateButton(lang, h, "location.retry")]),
    onData: (data) =>
      data.buttons.length === 0
        ? notice(lang, h, "status.nothing-here")
        : h.ul(
            [h.Class("stack")],
            data.buttons.map((b) =>
              h.li(
                [],
                [
                  h.button(
                    [h.OnClick(Message.ClickedButton({ id: b.button })), h.Class("button")],
                    [t(lang, buttonKey(b.button))],
                  ),
                ],
              ),
            ),
          ),
  });
};

/** What to show under the heading, depending on where we are. */
export const body = (model: Model, h: H): Html => {
  const { lang } = model;
  if (model.selected) return resultsView(model, h);
  return AsyncData.matchDataSplitEmpty(model.position, {
    onIdle: () =>
      notice(lang, h, "location.explain", [
        h.div([h.Class("notice-action")], [locateButton(lang, h, "location.allow")]),
      ]),
    onLoading: () => h.p([h.Class("muted")], [t(lang, "status.loading")]),
    onFailure: (reason) =>
      notice(lang, h, reason === "denied" ? "location.denied.help" : "location.unavailable", [
        h.div([h.Class("notice-action")], [locateButton(lang, h, "location.retry")]),
      ]),
    onData: () => buttonsView(model, h),
  });
};
