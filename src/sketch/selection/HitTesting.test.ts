import { describe, expect, it } from "vitest";
import type { Geometry } from "../model/Geometry.ts";
import { createCamera } from "../viewport/Camera.ts";
import { hitTest, hitTestAll } from "./HitTesting.ts";

const line: Geometry = {
  id: "line-1",
  type: "line",
  start: { x: 0, y: 0 },
  end: { x: 100, y: 0 },
  construction: false,
};

const circle: Geometry = {
  id: "circle-1",
  type: "circle",
  center: { x: 0, y: 0 },
  radius: 50,
  construction: false,
};

const arc: Geometry = {
  id: "arc-1",
  type: "arc",
  center: { x: 0, y: 0 },
  radius: 40,
  startAngle: 0,
  endAngle: Math.PI / 2,
  construction: false,
};

const point: Geometry = {
  id: "point-1",
  type: "point",
  position: { x: 10, y: 10 },
  construction: false,
};

describe("hitTest", () => {
  it("selects a line edge", () => {
    const camera = createCamera(800, 600, 2);
    const hit = hitTest([line], { x: 50, y: 1 }, { camera });
    expect(hit?.entityId).toBe("line-1");
    expect(hit?.part).toBe("edge");
  });

  it("prefers a line endpoint over the edge", () => {
    const camera = createCamera(800, 600, 2);
    const hit = hitTest([line], { x: 0.5, y: 0.5 }, { camera });
    expect(hit?.entityId).toBe("line-1");
    expect(hit?.part).toBe("endpoint-start");
  });

  it("selects a circle circumference and center", () => {
    const camera = createCamera(800, 600, 2);
    const edge = hitTest([circle], { x: 50, y: 0 }, { camera });
    const center = hitTest([circle], { x: 1, y: 0 }, { camera });
    expect(edge?.part).toBe("edge");
    expect(center?.part).toBe("center");
  });

  it("selects an arc edge only inside the sweep", () => {
    const camera = createCamera(800, 600, 2);
    const onArc = hitTest([arc], { x: 28.284271, y: 28.284271 }, { camera });
    const offArc = hitTest([arc], { x: -40, y: 0 }, { camera });
    expect(onArc?.entityId).toBe("arc-1");
    expect(onArc?.part).toBe("edge");
    expect(offArc).toBeNull();
  });

  it("selects arc endpoints and center", () => {
    const camera = createCamera(800, 600, 2);
    const start = hitTest([arc], { x: 40, y: 0 }, { camera });
    const end = hitTest([arc], { x: 0, y: 40 }, { camera });
    const center = hitTest([arc], { x: 0, y: 0 }, { camera });
    expect(start?.part).toBe("endpoint-start");
    expect(end?.part).toBe("endpoint-end");
    expect(center?.part).toBe("center");
  });

  it("selects a point entity", () => {
    const camera = createCamera(800, 600, 2);
    const hit = hitTest([point], { x: 10.5, y: 10.2 }, { camera });
    expect(hit?.entityId).toBe("point-1");
    expect(hit?.part).toBe("point");
  });

  it("prefers an endpoint over a coincident circle center when overlapping", () => {
    const camera = createCamera(800, 600, 2);
    const overlappingLine: Geometry = {
      id: "line-overlap",
      type: "line",
      start: { x: 0, y: 0 },
      end: { x: 20, y: 0 },
      construction: false,
    };
    const hit = hitTest([circle, overlappingLine], { x: 0, y: 0 }, { camera });
    expect(hit?.entityId).toBe("line-overlap");
    expect(hit?.part).toBe("endpoint-start");
  });

  it("keeps screen-space tolerance when zoomed in", () => {
    const camera = createCamera(800, 600, 20);
    // 0.2 mm * 20 px/mm = 4 px < 6 px tolerance
    const hit = hitTest([line], { x: 50, y: 0.2 }, { camera });
    expect(hit?.entityId).toBe("line-1");
  });

  it("keeps screen-space tolerance when zoomed out", () => {
    const camera = createCamera(800, 600, 0.5);
    // 8 mm * 0.5 px/mm = 4 px < 6 px tolerance
    const hit = hitTest([line], { x: 50, y: 8 }, { camera });
    expect(hit?.entityId).toBe("line-1");
    // 20 mm * 0.5 = 10 px > 6 px
    const miss = hitTest([line], { x: 50, y: 20 }, { camera });
    expect(miss).toBeNull();
  });

  it("returns ranked hits for overlapping geometry", () => {
    const camera = createCamera(800, 600, 2);
    const hits = hitTestAll([circle, line], { x: 0, y: 0 }, { camera });
    expect(hits[0]?.entityId).toBe("line-1");
    expect(hits.some((hit) => hit.entityId === "circle-1")).toBe(true);
  });
});
