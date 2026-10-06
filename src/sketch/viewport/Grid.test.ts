import { describe, expect, it } from "vitest";
import { chooseGridSpacing } from "./Grid.ts";

describe("chooseGridSpacing", () => {
  it("returns millimetre steps that densify when zooming in", () => {
    const zoomedOut = chooseGridSpacing(0.2);
    const medium = chooseGridSpacing(2);
    const zoomedIn = chooseGridSpacing(40);

    expect(zoomedOut.minorMm).toBeGreaterThan(medium.minorMm);
    expect(medium.minorMm).toBeGreaterThan(zoomedIn.minorMm);
    expect(zoomedOut.majorMm).toBe(zoomedOut.minorMm * 5);
    expect(medium.majorMm).toBe(medium.minorMm * 5);
    expect(zoomedIn.majorMm).toBe(zoomedIn.minorMm * 5);
  });

  it("only uses 1 / 2 / 5 × 10^n millimetre steps", () => {
    const scales = [0.05, 0.2, 0.5, 1, 2, 5, 10, 25, 80, 200];

    for (const scale of scales) {
      const spacing = chooseGridSpacing(scale);
      const mantissa =
        spacing.minorMm / 10 ** Math.floor(Math.log10(spacing.minorMm));
      expect([1, 2, 5]).toContain(Number(mantissa.toPrecision(6)));
    }
  });

  it("keeps minor spacing near a readable on-screen pitch", () => {
    for (const scale of [0.5, 2, 10, 50]) {
      const spacing = chooseGridSpacing(scale);
      const pixels = spacing.minorMm * scale;
      expect(pixels).toBeGreaterThanOrEqual(10);
      expect(pixels).toBeLessThanOrEqual(80);
    }
  });
});
