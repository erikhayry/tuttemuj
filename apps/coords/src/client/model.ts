import { CoordsNextResponse, CoordsRejection, GeoPoint } from "@tuttemuj/schema";
import { Schema } from "effect";
import { AsyncData, type Runtime } from "foldkit";
import { LoadNext } from "./command.ts";
import type { Message } from "./message.ts";

export const NextData = AsyncData.Schema(CoordsNextResponse, Schema.Literal("api"));

export const SaveError = Schema.Literals([...CoordsRejection.literals, "api"]);

export const SavedPlace = Schema.Struct({ name: Schema.String, location: GeoPoint });

export const Model = Schema.Struct({
  /** The place on screen. */
  next: NextData.schema,
  /** The coordinate field. */
  input: Schema.String,
  saving: Schema.Boolean,
  saveError: Schema.NullOr(SaveError),
  /** These lists are forgotten on reload. Saved and ignored places are already on disk. */
  skipped: Schema.Array(Schema.String),
  saved: Schema.Array(SavedPlace),
  /** Marked "Not in Nykarleby". */
  ignored: Schema.Array(Schema.String),
});
export type Model = typeof Model.Type;

export const init: Runtime.ApplicationInit<Model, Message> = () => ({
  model: {
    next: NextData.Loading(),
    input: "",
    saving: false,
    saveError: null,
    skipped: [],
    saved: [],
    ignored: [],
  },
  // Unlike apps/web, which waits for a click, this starts loading at once.
  commands: [LoadNext({ skipped: [] })],
});
