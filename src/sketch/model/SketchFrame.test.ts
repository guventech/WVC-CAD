import { describe, expect, it } from "vitest";
import { createEmptySketch } from "./Sketch.ts";
import {
  DATUM_AXIS_X_ID,
  DATUM_AXIS_Y_ID,
  DATUM_ORIGIN_ID,
  DEFAULT_SKETCH_PLANE,
  createDefaultSketchFrame,
  datumDisplayName,
  isDatumId,
  isDefaultSketchPlane,
  listDatumIds,
  resolveFrameAxisLine,
  resolveFrameOrigin,
} from "./SketchFrame.ts";

describe("SketchFrame", () => {
  it("seeds every empty sketch with a stable world frame", () => {
    const sketch = createEmptySketch();
    expect(sketch.frame).toEqual(createDefaultSketchFrame());
    expect(listDatumIds(sketch.frame)).toEqual([
      DATUM_ORIGIN_ID,
      DATUM_AXIS_X_ID,
      DATUM_AXIS_Y_ID,
    ]);
    expect(isDefaultSketchPlane(sketch.frame.plane)).toBe(true);
    expect(sketch.frame.plane).toEqual(DEFAULT_SKETCH_PLANE);
    expect(sketch.geometry).toEqual([]);
  });

  it("resolves origin at (0,0) and axis lines along +X / +Y", () => {
    const frame = createDefaultSketchFrame();
    expect(resolveFrameOrigin(frame)).toEqual({ x: 0, y: 0 });
    expect(resolveFrameAxisLine(frame, DATUM_AXIS_X_ID)).toEqual({
      start: { x: 0, y: 0 },
      end: { x: 1, y: 0 },
    });
    expect(resolveFrameAxisLine(frame, DATUM_AXIS_Y_ID)).toEqual({
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
    });
  });

  it("names datums for UI", () => {
    const frame = createDefaultSketchFrame();
    expect(datumDisplayName(frame, DATUM_ORIGIN_ID)).toBe("Origin");
    expect(datumDisplayName(frame, DATUM_AXIS_X_ID)).toBe("X axis");
    expect(datumDisplayName(frame, DATUM_AXIS_Y_ID)).toBe("Y axis");
    expect(isDatumId(frame, "line-1")).toBe(false);
  });
});
