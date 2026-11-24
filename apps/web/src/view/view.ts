import { message as t } from "@tuttemuj/messages";
import type { Document } from "foldkit/html";
import type { Model } from "../model.ts";
import { body } from "./screens.ts";
import type { H } from "./shared.ts";

export const view = (model: Model, h: H): Document => ({
  title: t(model.lang, "app.title"),
  body: h.main(
    [h.Class("app")],
    [
      h.header(
        [],
        [
          h.h1([h.Class("app-title")], [t(model.lang, "app.title")]),
          h.p([h.Class("app-tagline muted")], [t(model.lang, "app.tagline")]),
        ],
      ),
      body(model, h),
    ],
  ),
});
