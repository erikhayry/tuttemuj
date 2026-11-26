import { foldkit } from "@foldkit/vite-plugin";
import { defineConfig } from "vite";
import { env } from "./src/server/env.ts";

// The page calls `/api/...` and Vite forwards it to the local Effect server, so there is no CORS.
export default defineConfig({
  plugins: [foldkit()],
  server: {
    // Only this computer: the server behind the proxy writes to data/.
    host: "localhost",
    port: env.COORDS_PORT,
    strictPort: true,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${env.COORDS_API_PORT}`,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
