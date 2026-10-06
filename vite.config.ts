import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  build: {
    // Modern baseline keeps the shipped JS smaller/faster than legacy polyfill targets.
    target: "es2022",
    cssMinify: true,
    sourcemap: false,
    reportCompressedSize: true,
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./src/tests/setup.ts"],
  },
});
