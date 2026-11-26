import type { Html, HtmlBuilder } from "foldkit/html";
import type { Message } from "../message.ts";

export type H = HtmlBuilder<Message>;

/** A link that opens in a new tab, so the tool keeps its place. */
export const externalLink = (h: H, url: string, text: string): Html =>
  h.a([h.Href(url), h.Target("_blank"), h.Rel("noopener")], [text]);
