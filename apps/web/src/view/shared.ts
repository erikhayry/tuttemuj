import { type MessageKey, message as t } from "@tuttemuj/messages";
import type { ButtonId, Lang } from "@tuttemuj/schema";
import type { Html, HtmlBuilder } from "foldkit/html";
import { Message } from "../message.ts";

// VIEW
// All visible text goes through `t(lang, key)`, so nothing in this file is hard-coded Swedish.

export type H = HtmlBuilder<Message>;

export const buttonKey = (id: ButtonId): MessageKey => `buttons.${id}.label`;

export const notice = (lang: Lang, h: H, key: MessageKey, extra: ReadonlyArray<Html> = []): Html =>
  h.div([h.Class("card notice")], [h.p([], [t(lang, key)]), ...extra]);

export const locateButton = (lang: Lang, h: H, key: MessageKey): Html =>
  h.button([h.OnClick(Message.ClickedLocate()), h.Class("button")], [t(lang, key)]);
