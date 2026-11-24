import { Result, Schema } from "effect";

/**
 * Decode JSON-like input and report failure as a message, without throwing.
 * A bridge for code that still branches on success; new code should use Effect directly (#50).
 */
export const safeDecode =
  <S extends Schema.ConstraintDecoder<unknown>>(schema: S) =>
  (input: unknown): { success: true; data: S["Type"] } | { success: false; message: string } => {
    const result = Schema.decodeUnknownResult(schema)(input);
    return Result.isSuccess(result)
      ? { success: true, data: result.success }
      : { success: false, message: result.failure.message };
  };
