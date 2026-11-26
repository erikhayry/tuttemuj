import { AsyncData, type Update } from "foldkit";
import { modifyFields } from "foldkit/struct";
import { LoadNext, Save } from "./command.ts";
import { Message } from "./message.ts";
import { type Model, NextData } from "./model.ts";

/** The name of the place on screen, if one is. */
const currentName = (model: Model): string | undefined =>
  AsyncData.isSuccess(model.next) ? model.next.data.place?.name : undefined;

/** Clear the form and fetch the next place that is not in `skipped`. */
const advance = (model: Model, skipped: Model["skipped"]) => ({
  model: modifyFields(model, {
    next: () => NextData.Loading(),
    input: () => "",
    saving: () => false,
    saveError: () => null,
    skipped: () => skipped,
  }),
  commands: [LoadNext({ skipped })],
});

export const update = (model: Model, message: Message) =>
  Message.match<Update.Return<Model, Message>>(message, {
    SucceededLoadNext: ({ response }) => ({
      model: modifyFields(model, { next: () => NextData.Success({ data: response }) }),
    }),

    FailedLoadNext: () => ({
      model: modifyFields(model, { next: () => NextData.Failure({ error: "api" }) }),
    }),

    ChangedInput: ({ text }) => ({
      model: modifyFields(model, { input: () => text, saveError: () => null }),
    }),

    SubmittedCoords: () => {
      const name = currentName(model);
      if (!name || model.saving || !model.input.trim()) return { model };
      return {
        model: modifyFields(model, { saving: () => true, saveError: () => null }),
        commands: [Save({ name, input: model.input })],
      };
    },

    SucceededSave: ({ name, location }) =>
      advance(
        modifyFields(model, { saved: (saved) => [{ name, location }, ...saved] }),
        model.skipped,
      ),

    RejectedSave: ({ reason }) => ({
      model: modifyFields(model, { saving: () => false, saveError: () => reason }),
    }),

    FailedSave: () => ({
      model: modifyFields(model, { saving: () => false, saveError: () => "api" }),
    }),

    ClickedSkip: () => {
      const name = currentName(model);
      // While a save is on its way, skipping would show the next place and then jump past it.
      if (!name || model.saving) return { model };
      return advance(model, [...model.skipped, name]);
    },

    ClickedRetry: () => advance(model, model.skipped),
  });
