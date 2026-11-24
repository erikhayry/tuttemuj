import { Schema } from "effect";

// Effect: a schema is a value, and the TypeScript type comes from it with `typeof X.Type`
// (Zod: `z.infer<typeof X>`). `Literals` is Zod's `z.enum`; `.literals` is Zod's `.options`.
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
