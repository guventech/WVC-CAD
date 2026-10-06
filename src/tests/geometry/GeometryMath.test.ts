import { describe, expect, it } from "vitest";
import {
  angleFromTo,
  arcSweepRadians,
  closestPointOnSegment,
  distance,
  distancePointToSegment,
  isAngleInArcSweep,
  isApproximatelyEqual,
  normalizeAngle,
  pointsApproximatelyEqual,
  TOLERANCE,
} from "../../sketch/geometry/GeometryMath.ts";
import { WORLD_AXIS, WORLD_ORIGIN } from "../../sketch/model/CoordinateSystem.ts";

describe("coordinate system", () => {
  it("keeps the world origin at (0, 0) with X right and Y up", () => {
    expect(WORLD_ORIGIN).toEqual({ x: 0, y: 0 });
    expect(WORLD_AXIS).toEqual({ x: "right", y: "up" });
  });
});

describe("isApproximatelyEqual", () => {
  it("treats values inside the geometric tolerance as equal", () => {
    expect(isApproximatelyEqual(1, 1 + TOLERANCE.geometric / 2)).toBe(true);
    expect(isApproximatelyEqual(0, TOLERANCE.geometric)).toBe(true);
    expect(isApproximatelyEqual(-2, -2)).toBe(true);
  });

  it("treats values outside the geometric tolerance as different", () => {
    expect(isApproximatelyEqual(1, 1 + TOLERANCE.geometric * 10)).toBe(false);
  });

  it("uses an explicit tolerance when one is provided", () => {
    expect(isApproximatelyEqual(1, 1.2, 0.25)).toBe(true);
    expect(isApproximatelyEqual(1, 1.2, 0.1)).toBe(false);
  });
});

describe("pointsApproximatelyEqual", () => {
  it("compares both axes with geometric tolerance", () => {
    expect(
      pointsApproximatelyEqual({ x: 1, y: 2 }, { x: 1 + TOLERANCE.geometric / 2, y: 2 }),
    ).toBe(true);
    expect(pointsApproximatelyEqual({ x: 1, y: 2 }, { x: 1.1, y: 2 })).toBe(false);
  });
});

describe("distance helpers", () => {
  it("computes point distance and segment projection", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(
      distancePointToSegment({ x: 5, y: 2 }, { x: 0, y: 0 }, { x: 10, y: 0 }),
    ).toBe(2);
    expect(
      distancePointToSegment({ x: -2, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }),
    ).toBe(2);
    expect(closestPointOnSegment({ x: 5, y: 2 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toEqual({
      x: 5,
      y: 0,
    });
    expect(closestPointOnSegment({ x: -2, y: 1 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toEqual({
      x: 0,
      y: 0,
    });
  });
});

describe("arc angles", () => {
  it("normalizes angles and detects CCW sweeps, including wrap across 0", () => {
    expect(normalizeAngle(-Math.PI / 2)).toBeCloseTo((3 * Math.PI) / 2);
    expect(isAngleInArcSweep(Math.PI / 4, 0, Math.PI / 2)).toBe(true);
    expect(isAngleInArcSweep(Math.PI, 0, Math.PI / 2)).toBe(false);
    expect(isAngleInArcSweep(0.1, (3 * Math.PI) / 2, Math.PI / 2)).toBe(true);
    expect(arcSweepRadians(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2);
    expect(angleFromTo({ x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(Math.PI / 2);
  });
});
