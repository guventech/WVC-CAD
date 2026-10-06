import { describe, expect, it } from "vitest";
import {
  formatDimensionInputValue,
  parseDimensionInput,
} from "./DimensionInput.ts";

describe("DimensionInput (Chunk 18)", () => {
  it("parses length with optional mm suffix", () => {
    expect(parseDimensionInput("75", "length")).toEqual({ ok: true, value: 75 });
    expect(parseDimensionInput("75 mm", "length")).toEqual({ ok: true, value: 75 });
    expect(parseDimensionInput("12.5MM", "length")).toEqual({ ok: true, value: 12.5 });
  });

  it("rejects invalid or empty length", () => {
    expect(parseDimensionInput("", "length").ok).toBe(false);
    expect(parseDimensionInput("abc", "length").ok).toBe(false);
    expect(parseDimensionInput("75 cm", "length").ok).toBe(false);
  });

  it("parses angles in degrees by default and radians when marked", () => {
    const deg = parseDimensionInput("90", "angle");
    expect(deg.ok).toBe(true);
    if (deg.ok) {
      expect(deg.value).toBeCloseTo(Math.PI / 2, 10);
    }
    const marked = parseDimensionInput("90°", "angle");
    expect(marked.ok).toBe(true);
    if (marked.ok) {
      expect(marked.value).toBeCloseTo(Math.PI / 2, 10);
    }
    const rad = parseDimensionInput("1.57079632679 rad", "angle");
    expect(rad.ok).toBe(true);
    if (rad.ok) {
      expect(rad.value).toBeCloseTo(Math.PI / 2, 5);
    }
  });

  it("formats model values for the edit field", () => {
    expect(formatDimensionInputValue(50, "length")).toBe("50.00");
    expect(formatDimensionInputValue(Math.PI / 2, "angle")).toBe("90.0");
  });
});
