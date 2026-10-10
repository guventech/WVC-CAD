import { describe, expect, it } from "vitest";
import { distance } from "./GeometryMath.ts";
import { slotHalfWidthFromCursor, slotOutlineFromCenters } from "./SlotMath.ts";

describe("SlotMath", () => {
  it("builds parallel sides and equal-radius caps", () => {
    const outline = slotOutlineFromCenters(
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      5,
    )!;
    expect(outline.lineA.start.y).toBeCloseTo(5, 6);
    expect(outline.lineB.start.y).toBeCloseTo(-5, 6);
    expect(outline.arcStart.radius).toBe(5);
    expect(outline.arcEnd.radius).toBe(5);
    expect(distance(outline.lineA.start, outline.lineA.end)).toBeCloseTo(40, 6);
  });

  it("measures half-width from cursor offset", () => {
    expect(
      slotHalfWidthFromCursor({ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 20, y: 8 }),
    ).toBeCloseTo(8, 6);
  });
});
