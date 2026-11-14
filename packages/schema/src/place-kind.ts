import { z } from "zod";

export const PlaceKind = z.enum([
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
export type PlaceKind = z.infer<typeof PlaceKind>;
