import { describe, expect, it } from "vitest";
import type { Geometry } from "../model/Geometry.ts";
import { createCamera } from "../viewport/Camera.ts";
import {
  collectIntersectionCandidates,
  INTERSECTION_SNAP_PRIORITY,
} from "./intersectionSnap.ts";
import { findSnap } from "./SnapEngine.ts";

const horiz: Geometry = {
  id: "h",
  type: "line",
  start: { x: 0, y: 40 },
  end: { x: 100, y: 40 },
  construction: false,
};

const vert: Geometry = {
  id: "v",
  type: "line",
  start: { x: 60, y: 0 },
  end: { x: 60, y: 80 },
  construction: false,
};

describe("collectIntersectionCandidates", () => {
  it("finds a line–line intersection away from endpoints", () => {
    const hits = collectIntersectionCandidates([horiz, vert], new Set());
    expect(hits).toHaveLength(1);
    expect(hits[0]!.type).toBe("intersection");
    expect(hits[0]!.point).toEqual({ x: 60, y: 40 });
    expect(hits[0]!.priority).toBe(INTERSECTION_SNAP_PRIORITY);
  });

  it("returns no candidates for parallel lines", () => {
    const parallel: Geometry = {
      id: "h2",
      type: "line",
      start: { x: 0, y: 50 },
      end: { x: 100, y: 50 },
      construction: false,
    };
    expect(collectIntersectionCandidates([horiz, parallel], new Set())).toEqual([]);
  });

  it("offers both line–circle intersections", () => {
    const circle: Geometry = {
      id: "c",
      type: "circle",
      center: { x: 0, y: 0 },
      radius: 5,
      construction: false,
    };
    const line: Geometry = {
      id: "l",
      type: "line",
      start: { x: -10, y: 0 },
      end: { x: 10, y: 0 },
      construction: false,
    };
    const hits = collectIntersectionCandidates([line, circle], new Set());
    expect(hits).toHaveLength(2);
    const xs = hits.map((h) => h.point.x).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(-5);
    expect(xs[1]).toBeCloseTo(5);
  });

  it("offers both circle–circle intersections", () => {
    const a: Geometry = {
      id: "c1",
      type: "circle",
      center: { x: 0, y: 0 },
      radius: 5,
      construction: false,
    };
    const b: Geometry = {
      id: "c2",
      type: "circle",
      center: { x: 8, y: 0 },
      radius: 5,
      construction: false,
    };
    const hits = collectIntersectionCandidates([a, b], new Set());
    expect(hits).toHaveLength(2);
    expect(hits.every((h) => Math.abs(h.point.x - 4) < 1e-9)).toBe(true);
    expect(Math.abs(hits[0]!.point.y)).toBeCloseTo(3);
    expect(hits[0]!.point.y).toBeCloseTo(-hits[1]!.point.y);
  });

  it("filters arc–line hits to the CCW sweep", () => {
    const arc: Geometry = {
      id: "arc",
      type: "arc",
      center: { x: 0, y: 0 },
      radius: 10,
      startAngle: 0,
      endAngle: Math.PI / 2,
      construction: false,
    };
    const line: Geometry = {
      id: "l",
      type: "line",
      start: { x: -20, y: 0 },
      end: { x: 20, y: 0 },
      construction: false,
    };
    const hits = collectIntersectionCandidates([arc, line], new Set());
    expect(hits).toHaveLength(1);
    expect(hits[0]!.point.x).toBeCloseTo(10);
    expect(hits[0]!.point.y).toBeCloseTo(0);
  });

  it("filters arc–arc hits to both sweeps", () => {
    // Circles meet at (4, ±3). Keep only the upper point in both CCW sweeps.
    const a: Geometry = {
      id: "a1",
      type: "arc",
      center: { x: 0, y: 0 },
      radius: 5,
      startAngle: 0,
      endAngle: Math.PI / 2,
      construction: false,
    };
    const b: Geometry = {
      id: "a2",
      type: "arc",
      center: { x: 8, y: 0 },
      radius: 5,
      startAngle: Math.PI / 2,
      endAngle: Math.PI,
      construction: false,
    };
    const hits = collectIntersectionCandidates([a, b], new Set());
    expect(hits).toHaveLength(1);
    expect(hits[0]!.point.x).toBeCloseTo(4);
    expect(hits[0]!.point.y).toBeCloseTo(3);
  });

  it("skips excluded entity ids", () => {
    const hits = collectIntersectionCandidates([horiz, vert], new Set(["v"]));
    expect(hits).toEqual([]);
  });
});

describe("findSnap intersection priority", () => {
  it("snaps to intersection between endpoint and midpoint priority", () => {
    const camera = createCamera(800, 600, 2);
    const snap = findSnap({ x: 61, y: 39 }, [horiz, vert], {
      camera,
      gridSpacingMm: 50,
    });
    expect(snap?.type).toBe("intersection");
    expect(snap?.point).toEqual({ x: 60, y: 40 });
    expect(snap?.priority).toBe(INTERSECTION_SNAP_PRIORITY);
    expect(INTERSECTION_SNAP_PRIORITY).toBeGreaterThan(85); // midpoint
    expect(INTERSECTION_SNAP_PRIORITY).toBeLessThan(90); // endpoint
  });
});
