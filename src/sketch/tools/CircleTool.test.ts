import { describe, expect, it } from "vitest";
import { createEmptySketch } from "../model/Sketch.ts";
import { createCamera } from "../viewport/Camera.ts";
import { createSelectionState } from "../selection/SelectionManager.ts";
import {
  cancelCircleToolSession,
  createCircleToolState,
  handleCircleToolPointerDown,
  handleCircleToolPointerMove,
} from "./CircleTool.ts";
import type { ToolPointerContext } from "./ToolTypes.ts";

function contextAt(x: number, y: number): ToolPointerContext {
  return {
    worldPoint: { x, y },
    camera: createCamera(800, 600, 2),
    sketch: createEmptySketch(),
    selection: createSelectionState(),
    modifiers: { shift: false, ctrl: false, meta: false },
  };
}

describe("CircleTool", () => {
  it("places center then previews radius", () => {
    const start = handleCircleToolPointerDown(
      contextAt(0, 0),
      createCircleToolState(),
    );
    expect(start.state.phase).toBe("drawing");
    expect(start.state.center).toEqual({ x: 0, y: 0 });

    const move = handleCircleToolPointerMove(contextAt(40, 0), start.state);
    expect(move.previewCircle).toEqual({
      center: { x: 0, y: 0 },
      radiusPoint: { x: 40, y: 0 },
    });
    expect(move.circleRadiusMm).toBeCloseTo(40, 6);
    expect(move.activeSnap?.type).toBe("horizontal");
  });

  it("creates a circle on the second click", () => {
    const start = handleCircleToolPointerDown(
      contextAt(0, 0),
      createCircleToolState(),
    );
    const end = handleCircleToolPointerDown(contextAt(0, 30), start.state);
    expect(end.result.createCircle).toEqual({
      center: { x: 0, y: 0 },
      radiusPoint: { x: 0, y: 30 },
    });
    expect(end.state.phase).toBe("idle");
  });

  it("rejects zero radius", () => {
    const start = handleCircleToolPointerDown(
      contextAt(0, 0),
      createCircleToolState(),
    );
    const end = handleCircleToolPointerDown(contextAt(0, 0), start.state);
    expect(end.result.createCircle).toBeUndefined();
    expect(end.state.phase).toBe("drawing");
  });

  it("cancels an unfinished circle session", () => {
    const start = handleCircleToolPointerDown(
      contextAt(0, 0),
      createCircleToolState(),
    );
    const cancelled = cancelCircleToolSession(start.state);
    expect(cancelled.cancelled).toBe(true);
    expect(cancelled.state.phase).toBe("idle");
  });
});
