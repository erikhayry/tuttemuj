import { ButtonId, ButtonResultsResponse, ButtonsResponse } from "@tuttemuj/schema";
import { defineMessageUnion } from "foldkit/message";
import { LocateError, Position } from "./model.ts";

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
