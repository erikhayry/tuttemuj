import { CoordsNextResponse, CoordsRejection, GeoPoint } from "@tuttemuj/schema";
import { Schema } from "effect";
import { defineMessageUnion } from "foldkit/message";

export const Message = defineMessageUnion({
  SucceededLoadNext: { response: CoordsNextResponse },
  FailedLoadNext: {},
  ChangedInput: { text: Schema.String },
  SubmittedCoords: {},
  SucceededSave: { name: Schema.String, location: GeoPoint },
  RejectedSave: { reason: CoordsRejection },
  FailedSave: {},
  ClickedSkip: {},
  ClickedRetry: {},
});
export type Message = typeof Message.Type;
