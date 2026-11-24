import { createClient } from "@supabase/supabase-js";
import { Context, Effect, Layer, Schema } from "effect";

/** The database call failed (network, permissions, a missing function). Handlers turn it into a 500. */
export class DbError extends Schema.TaggedError<DbError>()("DbError", {
  message: Schema.String,
}) {}

// A *service* in Effect is an interface that code asks for by name and that a Layer provides, like
// React context or dependency injection. Handlers ask for `Db`; the server provides the Supabase
// one and tests can provide an in-memory one, without changing the handlers.
export class Db extends Context.Service<
  Db,
  {
    /** Call a Postgres function (`supabase/migrations`). Returns its rows, still unchecked. */
    readonly rpc: (name: string, args: Record<string, unknown>) => Effect.Effect<unknown, DbError>;
  }
>()("tuttemuj/Db") {
  /** Reads with the service role: the tables have no public policies. Keep this key on the server. */
  static layerSupabase = (url: string, key: string) =>
    Layer.sync(Db, () => {
      const db = createClient(url, key, { auth: { persistSession: false } });
      return {
        rpc: (name, args) =>
          // `Effect.tryPromise` turns a Promise into an Effect whose failure is typed.
          Effect.tryPromise({
            try: async () => {
              const { data, error } = await db.rpc(name, args);
              if (error) throw new Error(`${name}: ${error.message}`);
              return data;
            },
            catch: (e) => new DbError({ message: e instanceof Error ? e.message : String(e) }),
          }),
      };
    });
}
