/**
 * Reset the local test database and load the fixture (docs/testing.md). Never touches production:
 * it only talks to the local Supabase that `supabase start` runs, and refuses any other address.
 *
 *   pnpm test:db
 *
 * Writes `.env.test` at the repo root (gitignored) so the API tests can find the same database.
 */
import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { pickFixture, placesNearSpots } from "../fixture.ts";
import { readData } from "../read.ts";
import { buildRows } from "../rows.ts";
import { syncRows } from "../sync.ts";

const run = promisify(execFile);
const root = fileURLToPath(new URL("../../../../", import.meta.url));
const dataDir = process.env.DATA_DIR ?? `${root}data`;

/** `supabase status -o env` prints `NAME="value"` lines. Returns them as a map. */
const parseEnv = (text: string): Map<string, string> =>
  new Map(
    text
      .split("\n")
      .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => [m[1] as string, m[2] as string]),
  );

// `supabase start` is a no-op when the containers already run, so it is safe to call every time.
console.log("Starting local Supabase (needs Docker)...");
await run("supabase", ["start"], { cwd: root, maxBuffer: 50 * 1024 * 1024 }).catch((e) => {
  throw new Error(`supabase start failed. Is Docker running? ${e.stderr || e.message}`);
});

const status = parseEnv((await run("supabase", ["status", "-o", "env"], { cwd: root })).stdout);
// Newer CLIs call the server key SECRET_KEY, older ones SERVICE_ROLE_KEY.
const url = status.get("API_URL");
const key = status.get("SECRET_KEY") ?? status.get("SERVICE_ROLE_KEY");
if (!url || !key) throw new Error("supabase status did not print API_URL and a server key.");

// Guard: this script wipes the database, so it may only ever run against this machine.
const host = new URL(url).hostname;
if (host !== "127.0.0.1" && host !== "localhost") {
  throw new Error(`Refusing to reset ${host}: the test database must be local.`);
}

await run("supabase", ["db", "reset", "--no-seed"], { cwd: root, maxBuffer: 50 * 1024 * 1024 });
console.log("Migrations applied to the empty local database.");

await writeFile(`${root}.env.test`, `SUPABASE_URL=${url}\nSUPABASE_SECRET_KEY=${key}\n`);

const { pages, places, groups, frontier, imageClasses } = await readData(dataDir);
const full = buildRows(pages, places, groups, { frontier, classes: imageClasses });
const fixture = pickFixture(full, placesNearSpots(places));

const result = await syncRows(url, key, fixture);
console.log(
  `Fixture loaded: ${fixture.places.length} places, ${fixture.pages.length} pages, ` +
    `${fixture.events.length} events, ${fixture.placeUses.length} place uses, ` +
    `${fixture.relations.length} person-place relations, ${fixture.imageFacts.length} image facts.`,
);
console.log("Upserted:", result.upserted);
