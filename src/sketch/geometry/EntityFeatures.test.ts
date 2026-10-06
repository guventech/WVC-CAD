import { describe, expect, it } from "vitest";
import type { Geometry } from "../model/Geometry.ts";
import {
  listEntityFeatures,
  listHandlePoints,
  listSnapFeatures,
  pointOnCircle,
} from "./EntityFeatures.ts";

describe("EntityFeatures", () => {
  it("computes a point on a circle", () => {
    expect(pointOnCircle({ x: 0, y: 0 }, 10, 0)).toEqual({ x: 10, y: 0 });
    expect(pointOnCircle({ x: 0, y: 0 }, 10, Math.PI / 2).x).toBeCloseTo(0);
    expect(pointOnCircle({ x: 0, y: 0 }, 10, Math.PI / 2).y).toBeCloseTo(10);
  });

  it("lists line endpoints and midpoint for snap; handles stay endpoints", () => {
    const line: Geometry = {
      id: "l1",
      type: "line",
      start: { x: 0, y: 0 },
      end: { x: 10, y: 0 },
      construction: false,
    };

    expect(listSnapFeatures(line).map((f) => f.kind)).toEqual([
      "endpoint-start",
      "endpoint-end",
      "midpoint",
    ]);
    expect(listHandlePoints(line)).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
  });

  it("includes circle center in snap features and handles", () => {
    const circle: Geometry = {
      id: "c1",
      type: "circle",
      center: { x: 1, y: 2 },
      radius: 3,
      construction: false,
    };

    expect(listSnapFeatures(circle).map((f) => f.kind)).toEqual(["center"]);
    expect(listEntityFeatures(circle)[0]?.kind).toBe("center");
    expect(listHandlePoints(circle)).toEqual([{ x: 1, y: 2 }]);
  });

  it("lists arc center and endpoints for snap", () => {
    const arc: Geometry = {
      id: "a1",
      type: "arc",
      center: { x: 0, y: 0 },
      radius: 10,
      startAngle: 0,
      endAngle: Math.PI / 2,
      construction: false,
    };

    const features = listEntityFeatures(arc);
    expect(features.map((f) => f.kind)).toEqual([
      "center",
      "endpoint-start",
      "endpoint-end",
    ]);
    expect(listSnapFeatures(arc).map((f) => f.kind)).toEqual([
      "center",
      "endpoint-start",
      "endpoint-end",
    ]);
  });
});
