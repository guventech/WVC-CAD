import { describe, expect, it } from "vitest";
import {
  intersectCircles,
  intersectInfiniteLines,
  intersectLineCircle,
  intersectLineSegments,
  lineParameter,
  pointAtParameter,
} from "../../sketch/geometry/Intersections.ts";

describe("Intersections", () => {
  it("finds crossing of two segments at midpoints", () => {
    const hit = intersectLineSegments(
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: -5 },
      { x: 5, y: 5 },
    );
    expect(hit).not.toBeNull();
    expect(hit!.point).toEqual({ x: 5, y: 0 });
    expect(hit!.tA).toBeCloseTo(0.5);
    expect(hit!.tB).toBeCloseTo(0.5);
  });

  it("returns null for parallel segments", () => {
    expect(
      intersectLineSegments(
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 1 },
        { x: 10, y: 1 },
      ),
    ).toBeNull();
  });

  it("returns null when intersection is outside a segment", () => {
    expect(
      intersectLineSegments(
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 15, y: -5 },
        { x: 15, y: 5 },
      ),
    ).toBeNull();
  });

  it("finds infinite-line intersection past segment ends", () => {
    const hit = intersectInfiniteLines(
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: -5 },
      { x: 20, y: 5 },
    );
    expect(hit).not.toBeNull();
    expect(hit!.tA).toBeCloseTo(2);
    expect(hit!.point).toEqual({ x: 20, y: 0 });
  });

  it("maps parameters along a segment", () => {
    expect(lineParameter({ x: 5, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(
      0.5,
    );
    expect(pointAtParameter({ x: 0, y: 0 }, { x: 10, y: 0 }, 0.25)).toEqual({
      x: 2.5,
      y: 0,
    });
  });

  it("intersects a horizontal line with a circle at two points", () => {
    const hits = intersectLineCircle(
      { x: -10, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 0 },
      5,
    );
    expect(hits).toHaveLength(2);
    expect(hits[0]!.point.x).toBeCloseTo(-5);
    expect(hits[1]!.point.x).toBeCloseTo(5);
  });

  it("intersects two circles at symmetric points", () => {
    const hits = intersectCircles({ x: 0, y: 0 }, 5, { x: 8, y: 0 }, 5);
    expect(hits).toHaveLength(2);
    expect(hits[0]!.x).toBeCloseTo(4);
    expect(hits[1]!.x).toBeCloseTo(4);
    expect(Math.abs(hits[0]!.y)).toBeCloseTo(3);
    expect(hits[0]!.y).toBeCloseTo(-hits[1]!.y);
  });
});
