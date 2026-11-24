import { ButtonId, ButtonResultsResponse, ButtonsResponse } from "@tuttemuj/schema";
import { Schema } from "effect";
import { AsyncData, type Runtime } from "foldkit";
import type { Message } from "./message.ts";

// MODEL
// The app is a few steps: find the position, load the buttons that have results there, then load
// the results of one button. Each step is an `AsyncData` (Idle, Loading, Success, Failure): like the
// `{ data, isLoading, error }` of React Query, but as one value that cannot be in two states at once.

export const Position = Schema.Struct({ lat: Schema.Number, lng: Schema.Number });
export type Position = typeof Position.Type;

/** Why the position failed. An id, not text: the view turns it into a message in the user's language. */
export const LocateError = Schema.Literals(["denied", "unavailable"]);

/** The API could not be reached or answered badly. */
const ApiError = Schema.Literal("api");

export const PositionData = AsyncData.Schema(Position, LocateError);
export const ButtonsData = AsyncData.Schema(ButtonsResponse, ApiError);
export const ResultsData = AsyncData.Schema(ButtonResultsResponse, ApiError);

export const Model = Schema.Struct({
  lang: Schema.Literals(["sv", "fi", "en"]),
  position: PositionData.schema,
  buttons: ButtonsData.schema,
  /** The button the user opened, if any. */
  selected: Schema.NullOr(ButtonId),
  results: ResultsData.schema,
});
export type Model = typeof Model.Type;

// INIT

export const init: Runtime.ApplicationInit<Model, Message> = () => ({
  model: {
    lang: "sv",
    position: PositionData.Idle(),
    buttons: ButtonsData.Idle(),
    selected: null,
    results: ResultsData.Idle(),
  },
});
