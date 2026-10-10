import { describe, expect, it } from "vitest";
import type { Geometry } from "../model/Geometry.ts";
import { createCamera } from "../viewport/Camera.ts";
import { findSnap } from "./SnapEngine.ts";

const line: Geometry = {
  id: "line-1",
  type: "line",
  start: { x: 50, y: 0 },
  end: { x: 100, y: 0 },
  construction: false,
};

const point: Geometry = {
  id: "point-1",
  type: "point",
  position: { x: 20, y: 20 },
  construction: false,
};

describe("findSnap", () => {
  it("snaps to the world origin", () => {
    const camera = createCamera(800, 600, 2);
    const snap = findSnap({ x: 1, y: -1 }, [], {
      camera,
      gridSpacingMm: 10,
    });

    expect(snap?.type).toBe("origin");
    expect(snap?.point).toEqual({ x: 0, y: 0 });
  });

  it("snaps to the nearest grid intersection", () => {
    const camera = createCamera(800, 600, 2);
    const snap = findSnap({ x: 23, y: 18 }, [], {
      camera,
      gridSpacingMm: 10,
    });

    expect(snap?.type).toBe("grid");
    expect(snap?.point).toEqual({ x: 20, y: 20 });
  });

  it("prefers existing endpoints over grid", () => {
    const camera = createCamera(800, 600, 2);
    const snap = findSnap({ x: 49, y: 1 }, [line, point], {
      camera,
      gridSpacingMm: 10,
    });

    expect(snap?.type).toBe("endpoint");
    expect(snap?.point).toEqual({ x: 50, y: 0 });
    expect(snap?.sourceEntityId).toBe("line-1");
  });

  it("infers horizontal alignment relative to alignTo", () => {
    const camera = createCamera(800, 600, 2);
    // Free-axis X is midway between grid lines so pure H wins (no grid combine).
    const snap = findSnap({ x: 35, y: 0.5 }, [], {
      camera,
      gridSpacingMm: 10,
      alignTo: { x: 0, y: 0 },
    });

    expect(snap?.type).toBe("horizontal");
    expect(snap?.point.y).toBe(0);
    expect(snap?.point.x).toBeCloseTo(35, 6);
  });

  it("infers vertical alignment relative to alignTo", () => {
    const camera = createCamera(800, 600, 2);
    // Free-axis Y midway between grid lines so pure V wins (no grid combine).
    const snap = findSnap({ x: 0.5, y: 35 }, [], {
      camera,
      gridSpacingMm: 10,
      alignTo: { x: 0, y: 0 },
    });

    expect(snap?.type).toBe("vertical");
    expect(snap?.point.x).toBe(0);
    expect(snap?.point.y).toBeCloseTo(35, 6);
  });

  it("combines horizontal inference with grid snap on the free axis", () => {
    const camera = createCamera(800, 600, 2);
    // Near-horizontal from origin; free X is near the 40 mm grid line.
    // Regression: H must not steal the snap with raw cursor X and drop grid.
    const snap = findSnap({ x: 37, y: 1 }, [], {
      camera,
      gridSpacingMm: 10,
      alignTo: { x: 0, y: 0 },
    });

    expect(snap?.type).toBe("horizontal");
    expect(snap?.point).toEqual({ x: 40, y: 0 });
    expect(snap?.label).toMatch(/Grid/i);
  });

  it("combines vertical inference with grid snap on the free axis", () => {
    const camera = createCamera(800, 600, 2);
    const snap = findSnap({ x: 1, y: 37 }, [], {
      camera,
      gridSpacingMm: 10,
      alignTo: { x: 0, y: 0 },
    });

    expect(snap?.type).toBe("vertical");
    expect(snap?.point).toEqual({ x: 0, y: 40 });
    expect(snap?.label).toMatch(/Grid/i);
  });

  it("prefers endpoint coincidence over horizontal inference", () => {
    const camera = createCamera(800, 600, 2);
    const snap = findSnap({ x: 50, y: 1 }, [line], {
      camera,
      gridSpacingMm: 10,
      alignTo: { x: 0, y: 0 },
    });

    expect(snap?.type).toBe("endpoint");
    expect(snap?.point).toEqual({ x: 50, y: 0 });
  });

  it("can snap to an existing point entity", () => {
    const camera = createCamera(800, 600, 2);
    const snap = findSnap({ x: 21, y: 19 }, [point], {
      camera,
      gridSpacingMm: 10,
    });

    expect(snap?.type).toBe("point");
    expect(snap?.sourceEntityId).toBe("point-1");
    expect(snap?.point).toEqual({ x: 20, y: 20 });
  });

  it("snaps to line midpoints", () => {
    const camera = createCamera(800, 600, 2);
    const snap = findSnap({ x: 75, y: 1 }, [line], {
      camera,
      gridSpacingMm: 10,
    });

    expect(snap?.type).toBe("midpoint");
    expect(snap?.point).toEqual({ x: 75, y: 0 });
    expect(snap?.sourceEntityId).toBe("line-1");
  });

  it("snaps to circle centers", () => {
    const camera = createCamera(800, 600, 2);
    const circle: Geometry = {
      id: "circle-1",
      type: "circle",
      center: { x: 30, y: 40 },
      radius: 15,
      construction: false,
    };
    const snap = findSnap({ x: 31, y: 39 }, [circle], {
      camera,
      gridSpacingMm: 10,
    });

    expect(snap?.type).toBe("center");
    expect(snap?.point).toEqual({ x: 30, y: 40 });
  });

  it("snaps onto a line segment (point-on-entity)", () => {
    const camera = createCamera(800, 600, 2);
    // Near the line but away from endpoints/midpoint/grid contest.
    const snap = findSnap({ x: 62, y: 1 }, [line], {
      camera,
      gridSpacingMm: 50,
    });

    expect(snap?.type).toBe("onEntity");
    expect(snap?.point.y).toBeCloseTo(0, 6);
    expect(snap?.point.x).toBeCloseTo(62, 6);
  });

  it("ignores excluded entities while moving a point", () => {
    const camera = createCamera(800, 600, 2);
    const snap = findSnap({ x: 21, y: 19 }, [point], {
      camera,
      gridSpacingMm: 10,
      excludeEntityIds: ["point-1"],
    });

    expect(snap?.type).toBe("grid");
    expect(snap?.point).toEqual({ x: 20, y: 20 });
  });

  it("snaps to a line–line intersection away from endpoints", () => {
    const camera = createCamera(800, 600, 2);
    const crossing: readonly Geometry[] = [
      {
        id: "h",
        type: "line",
        start: { x: 0, y: 40 },
        end: { x: 100, y: 40 },
        construction: false,
      },
      {
        id: "v",
        type: "line",
        start: { x: 60, y: 0 },
        end: { x: 60, y: 80 },
        construction: false,
      },
    ];
    const snap = findSnap({ x: 61, y: 39 }, crossing, {
      camera,
      gridSpacingMm: 50,
    });

    expect(snap?.type).toBe("intersection");
    expect(snap?.point).toEqual({ x: 60, y: 40 });
  });
});
