import { AsyncData } from "foldkit";
import type { Document, Html } from "foldkit/html";
import { Message } from "../message.ts";
import type { Model } from "../model.ts";
import { placeView } from "./place.ts";
import { savedView } from "./saved.ts";
import type { H } from "./shared.ts";

const body = (model: Model, h: H): Html =>
  AsyncData.matchDataSplitEmpty(model.next, {
    onIdle: () => h.empty,
    onLoading: () => h.p([h.Class("muted")], ["Loading…"]),
    onFailure: () =>
      h.div(
        [h.Class("card")],
        [
          h.p([], ["The local server did not answer."]),
          h.button([h.OnClick(Message.ClickedRetry()), h.Class("button")], ["Try again"]),
        ],
      ),
    onData: ({ place }) =>
      place
        ? placeView(model, h, place)
        : h.p([h.Class("card")], ["No more places. Reload to see the skipped ones again."]),
  });

export const view = (model: Model, h: H): Document => ({
  title: "Tuttemuj coords",
  body: h.main(
    [h.Class("app")],
    [
      h.header(
        [h.Class("app-header")],
        [
          h.h1([h.Class("app-title")], ["Coords"]),
          h.p(
            [h.Class("muted")],
            [
              AsyncData.isSuccess(model.next)
                ? `${model.next.data.remaining} places without coordinates`
                : "",
            ],
          ),
        ],
      ),
      body(model, h),
      savedView(model, h),
    ],
  ),
});
