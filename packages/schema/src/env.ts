import { Effect, Schema } from "effect";

// Environment variables are always strings. Effect has no `z.coerce`: you pick a schema that decodes
// from a string (`FiniteFromString`) and add the rules on top with `.check(...)`.
/** An integer env var with a default. The default is given as a number, the decoded type is `number`. */
export const envInt = (
  fallback: number,
  ...checks: ReadonlyArray<ReturnType<typeof Schema.isGreaterThan>>
) =>
  Schema.FiniteFromString.check(Schema.isInt(), ...checks).pipe(
    Schema.withDecodingDefaultTypeKey(Effect.succeed(fallback)),
  );

/** A string env var with a default (Zod: `z.string().default(x)`). */
export const envString = (fallback: string) =>
  Schema.String.pipe(Schema.withDecodingDefaultTypeKey(Effect.succeed(fallback)));

/** An http(s) URL, kept as a string (Zod: `z.url()`). */
export const EnvUrl = Schema.String.check(Schema.isPattern(/^https?:\/\/\S+$/));

/** An API key or secret: at least 20 characters (Zod: `z.string().min(20)`). */
export const EnvSecret = Schema.String.check(Schema.isMinLength(20));

/** The fields every Supabase script needs. Spread into a `Schema.Struct` to add more. */
export const supabaseEnvFields = {
  SUPABASE_URL: EnvUrl,
  SUPABASE_SECRET_KEY: EnvSecret,
};

/** Decode `process.env` with a schema. Unknown variables are ignored. */
export const readEnv = <S extends Schema.ConstraintDecoder<unknown>>(
  schema: S,
  env: NodeJS.ProcessEnv = process.env,
): S["Type"] => Schema.decodeUnknownSync(schema)(env);
