/**
 * Lightweight gate: src/sketch/** must not import React or UI modules
 * (docs/ARCHITECTURE.md domain/UI boundary).
 */
import { describe, expect, it } from "vitest";

const sources = import.meta.glob("./**/*.{ts,tsx}", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

const FORBIDDEN =
  /from\s+["']react(?:-dom)?["']|from\s+["'][^"']*\/(?:ui|app)\/[^"']*["']/;

describe("architecture boundary", () => {
  it("src/sketch production sources do not import React or UI/app modules", () => {
    const violations: string[] = [];
    for (const [path, text] of Object.entries(sources)) {
      if (path.includes(".test.")) {
        continue;
      }
      if (FORBIDDEN.test(text)) {
        violations.push(path.replace(/^\.\//, ""));
      }
    }
    expect(violations).toEqual([]);
  });
});
