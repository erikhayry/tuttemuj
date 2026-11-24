import { Effect, Schema } from "effect";

// Effect: a decoding default is an Effect (`Effect.succeed(value)`), not a plain value or thunk as in
// Zod's `.default(value)`. `withDecodingDefaultKey` applies it when the key is missing in the input.
/**
 * An array field that may be missing in the data: decoding fills in `[]`.
 * Replaces Zod's `.array(x).default([])`; the decoded type is a plain array.
 */
export const ArrayWithDefault = <S extends Schema.Constraint>(item: S) =>
  Schema.Array(item).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed([] as ReadonlyArray<S["Encoded"]>)),
  );
