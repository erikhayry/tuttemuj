import { AsyncData, type Update } from "foldkit";
import { modifyFields } from "foldkit/struct";
import { LoadButtons, LoadResults, Locate } from "./command.ts";
import { Message } from "./message.ts";
import { ButtonsData, type Model, PositionData, ResultsData } from "./model.ts";

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
