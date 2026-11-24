import { foldkit } from "@foldkit/vite-plugin";
import { defineConfig } from "vite";

// In development the app calls `/api/...`, and Vite forwards it to the local Effect server
// (`pnpm --filter @tuttemuj/api dev:v1`), so the browser sees one origin and needs no CORS.
export default defineConfig({
  plugins: [foldkit()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
