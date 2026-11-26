import { fileURLToPath } from "node:url";
import { envInt, envString, readEnv } from "@tuttemuj/schema";
import { Schema } from "effect";

export const env = readEnv(
  Schema.Struct({
    /** The page. */
    COORDS_PORT: envInt(5175),
    /** The API behind it. */
    COORDS_API_PORT: envInt(8790),
    /** Point at a copy of data/ to try the tool without touching the real files. */
    DATA_DIR: envString(fileURLToPath(new URL("../../../../data", import.meta.url))),
  }),
);
