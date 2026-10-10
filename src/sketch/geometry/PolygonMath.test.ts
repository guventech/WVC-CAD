import { describe, expect, it } from "vitest";
import { distance } from "./GeometryMath.ts";
import {
  clampPolygonSides,
  MAX_POLYGON_SIDES,
  MIN_POLYGON_SIDES,
  regularPolygonVertices,
} from "./PolygonMath.ts";

describe("PolygonMath", () => {
  it("builds a regular hexagon with equal side lengths", () => {
    const verts = regularPolygonVertices({ x: 0, y: 0 }, { x: 10, y: 0 }, 6)!;
    expect(verts).toHaveLength(6);
    const side = distance(verts[0]!, verts[1]!);
    for (let i = 1; i < 6; i += 1) {
      expect(distance(verts[i]!, verts[(i + 1) % 6]!)).toBeCloseTo(side, 6);
    }
    expect(distance({ x: 0, y: 0 }, verts[0]!)).toBeCloseTo(10, 6);
  });

  it("builds triangles and clamps side counts into 3–32", () => {
    expect(regularPolygonVertices({ x: 0, y: 0 }, { x: 0, y: 0 }, 6)).toBeNull();
    expect(regularPolygonVertices({ x: 0, y: 0 }, { x: 10, y: 0 }, 3)).toHaveLength(
      3,
    );
    expect(clampPolygonSides(2)).toBe(MIN_POLYGON_SIDES);
    expect(clampPolygonSides(100)).toBe(MAX_POLYGON_SIDES);
    expect(
      regularPolygonVertices({ x: 0, y: 0 }, { x: 10, y: 0 }, 2),
    ).toHaveLength(MIN_POLYGON_SIDES);
  });
});
