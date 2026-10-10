import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  // Fixed port so Tauri `devUrl` (http://localhost:5173) stays stable.
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    // Modern baseline keeps the shipped JS smaller/faster than legacy polyfill targets.
    target: "es2022",
    cssMinify: true,
    sourcemap: false,
    reportCompressedSize: true,
  },
  clearScreen: false,
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./src/tests/setup.ts"],
  },
});
