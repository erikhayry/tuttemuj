import { Schema } from "effect";

export const PlaceKind = Schema.Literals([
  "street",
  "building",
  "farm",
  "district",
  "landmark",
  "waterbody",
  "island",
  "village",
  "other",
]);
export type PlaceKind = typeof PlaceKind.Type;
