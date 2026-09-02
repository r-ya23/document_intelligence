import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Separate from vite.config.ts on purpose: vitest ships its own bundled `vite`, so mixing the
// `test` field into the app's vite config causes plugin-type conflicts between the two vite copies.
// Keeping the test config standalone (and omitting the tailwind plugin, which tests don't need)
// avoids that. Vitest picks this file up automatically.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
