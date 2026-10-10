import { describe, expect, it } from "vitest";
import { createCamera } from "../viewport/Camera.ts";
import { createEmptySketch } from "../model/Sketch.ts";
import { createSelectionState } from "../selection/SelectionManager.ts";
import {
  adjustPolygonSides,
  createPolygonToolState,
  handlePolygonToolPointerDown,
  setPolygonSides,
} from "./PolygonTool.ts";
import type { ToolPointerContext } from "./ToolTypes.ts";

function context(worldPoint: { x: number; y: number }): ToolPointerContext {
  return {
    worldPoint,
    camera: createCamera(800, 600),
    sketch: createEmptySketch(),
    selection: createSelectionState(),
    modifiers: { shift: false, ctrl: false, meta: false },
  };
}

describe("PolygonTool", () => {
  it("remembers side count across idle resets and create", () => {
    let state = setPolygonSides(createPolygonToolState(), 8);
    expect(state.sides).toBe(8);
    state = adjustPolygonSides(state, -1);
    expect(state.sides).toBe(7);

    const first = handlePolygonToolPointerDown(context({ x: 0, y: 0 }), state);
    expect(first.result.polygonSides).toBe(7);
    const second = handlePolygonToolPointerDown(
      context({ x: 10, y: 0 }),
      first.state,
    );
    expect(second.result.createPolygon?.sides).toBe(7);
    expect(createPolygonToolState().sides).toBe(7);
    setPolygonSides(createPolygonToolState(), 6);
  });
});
