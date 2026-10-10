import { describe, expect, it } from "vitest";
import { distance, isApproximatelyEqual, TOLERANCE } from "../geometry/GeometryMath.ts";
import { createEmptySketch } from "../model/Sketch.ts";
import { createSelectionState } from "../selection/SelectionManager.ts";
import { createCamera } from "../viewport/Camera.ts";
import {
  buildThreePointArc,
  createArc3ToolState,
  handleArc3ToolPointerDown,
} from "./Arc3Tool.ts";
import type { ToolPointerContext } from "./ToolTypes.ts";

function contextAt(x: number, y: number): ToolPointerContext {
  return {
    worldPoint: { x, y },
    camera: createCamera(800, 600),
    sketch: createEmptySketch(),
    selection: createSelectionState(),
    modifiers: { shift: false, ctrl: false, meta: false },
  };
}

describe("Arc3Tool", () => {
  it("builds a CCW arc through three points on a known circle", () => {
    const built = buildThreePointArc(
      { x: 10, y: 0 },
      { x: 0, y: 10 },
      { x: -10, y: 0 },
    );
    expect(built).not.toBeNull();
    expect(built!.preview.center.x).toBeCloseTo(0, 6);
    expect(built!.preview.center.y).toBeCloseTo(0, 6);
    expect(built!.preview.radius).toBeCloseTo(10, 6);
    expect(
      distance(built!.preview.center, { x: 0, y: 10 }),
    ).toBeCloseTo(built!.preview.radius, 6);
  });

  it("rejects collinear points", () => {
    expect(
      buildThreePointArc(
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 },
      ),
    ).toBeNull();
  });

  it("commits an arc after three clicks", () => {
    let state = createArc3ToolState();
    const first = handleArc3ToolPointerDown(contextAt(10, 0), state);
    state = first.state;
    expect(state.phase).toBe("firstSet");

    const second = handleArc3ToolPointerDown(contextAt(0, 10), state);
    state = second.state;
    expect(state.phase).toBe("secondSet");

    const third = handleArc3ToolPointerDown(contextAt(-10, 0), state);
    expect(third.result.createArc).toBeDefined();
    expect(third.state.phase).toBe("idle");
    const center = third.result.createArc!.center;
    expect(isApproximatelyEqual(center.x, 0, TOLERANCE.coincidence)).toBe(true);
    expect(isApproximatelyEqual(center.y, 0, TOLERANCE.coincidence)).toBe(true);
  });
});
