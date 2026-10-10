import { describe, expect, it } from "vitest";
import {
  offsetClosedPolygon,
  offsetLineSegment,
  offsetOpenPolyline,
  signedOffsetFromLine,
} from "./OffsetMath.ts";

describe("OffsetMath", () => {
  it("offsets a horizontal segment upward for positive distance", () => {
    const offset = offsetLineSegment({ x: 0, y: 0 }, { x: 10, y: 0 }, 3)!;
    expect(offset.start.y).toBeCloseTo(3, 6);
    expect(offset.end.y).toBeCloseTo(3, 6);
  });

  it("measures signed cursor offset", () => {
    expect(
      signedOffsetFromLine({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 4 }),
    ).toBeCloseTo(4, 6);
  });

  it("offsets a CCW square inward for positive (left) distance", () => {
    const verts = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const offset = offsetClosedPolygon(verts, 2)!;
    expect(offset).toHaveLength(4);
    // Interior is on the left of a CCW boundary → +d shrinks.
    expect(offset[0]!.x).toBeCloseTo(2, 5);
    expect(offset[0]!.y).toBeCloseTo(2, 5);
    expect(offset[2]!.x).toBeCloseTo(8, 5);
    expect(offset[2]!.y).toBeCloseTo(8, 5);
  });

  it("offsets an open L-chain", () => {
    const verts = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ];
    const offset = offsetOpenPolyline(verts, 2)!;
    expect(offset).toHaveLength(3);
    expect(offset[0]!.y).toBeCloseTo(2, 5);
    expect(offset[2]!.x).toBeCloseTo(8, 5);
  });
});
