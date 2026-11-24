import { Effect, Schema } from "effect";

/**
 * An array field that may be missing in the data: decoding fills in `[]`.
 * Replaces Zod's `.array(x).default([])`; the decoded type is a plain array.
 */
export const ArrayWithDefault = <S extends Schema.Constraint>(item: S) =>
  Schema.Array(item).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed([] as ReadonlyArray<S["Encoded"]>)),
  );
