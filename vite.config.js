import { defineConfig } from "vitest/config";
import preact from "@preact/preset-vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [preact()],
  test: {
    environment: "jsdom",
    globals: false,
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,
    setupFiles: ["src/test/setup.js"],
  },
});
