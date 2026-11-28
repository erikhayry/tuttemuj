import { defineConfig } from "@playwright/test";

// Playwright Test runs the API tests (docs/testing.md). It starts the v1 server itself. The server
// needs SUPABASE_URL and SUPABASE_SECRET_KEY: `pnpm test:db` writes the local test database's values
// to `.env.test`, which is read first. In CI they come from the environment instead.
const PORT = Number(process.env.PORT ?? 8787);

export default defineConfig({
  testDir: "tests/api",
  testMatch: "**/*.spec.ts",
  // One request at a time, like the crawler: the tests are fast and the database is shared.
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
  },
  webServer: {
    // Run node directly, not through pnpm, so that stopping the server also stops the process.
    command:
      "node --env-file-if-exists=../../.env.test --env-file-if-exists=../../.env --import tsx src/v1/server.ts",
    // Playwright waits for this URL to answer before it runs a test. `/health` answers 204.
    url: `http://localhost:${PORT}/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
