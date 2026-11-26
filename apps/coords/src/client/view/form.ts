import type { Html } from "foldkit/html";
import { Message } from "../message.ts";
import type { Model } from "../model.ts";
import type { H } from "./shared.ts";

const ERRORS: Record<NonNullable<Model["saveError"]>, string> = {
  unreadable: "No coordinates found. Paste “63.5241, 22.5285” or a full Google Maps URL.",
  "outside-area": "Not saved: that point is outside the Nykarleby area.",
  "already-located": "This place already has coordinates. Press Skip.",
  api: "Not saved: the local server did not answer.",
};

export const coordsForm = (model: Model, h: H): Html =>
  // `OnSubmit` also fires on Enter, and stops the browser from reloading the page.
  h.form(
    [h.OnSubmit(Message.SubmittedCoords()), h.Class("coords-form")],
    [
      h.input([
        h.Type("text"),
        h.Class("input"),
        h.AriaLabel("Coordinates"),
        h.Placeholder("Paste coordinates or a Google Maps URL"),
        h.Autocomplete("off"),
        h.Autofocus(true),
        // A controlled input, as in React: the Model holds the text.
        h.Value(model.input),
        h.OnInput((text) => Message.ChangedInput({ text })),
      ]),
      h.button([h.Type("submit"), h.Class("button"), h.Disabled(model.saving)], ["Save"]),
      h.button(
        [
          h.Type("button"),
          h.Class("button button-quiet"),
          h.Disabled(model.saving),
          h.OnClick(Message.ClickedSkip()),
        ],
        ["Skip"],
      ),
      h.button(
        [
          h.Type("button"),
          h.Class("button button-quiet"),
          h.Disabled(model.saving),
          h.OnClick(Message.ClickedNotInNykarleby()),
        ],
        ["Not in Nykarleby"],
      ),
      ...(model.saveError
        ? [h.p([h.Class("error"), h.Role("alert")], [ERRORS[model.saveError]])]
        : []),
    ],
  );
