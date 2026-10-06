import { describe, expect, it } from "vitest";
import { createEmptySketch } from "../model/Sketch.ts";
import { createCamera } from "../viewport/Camera.ts";
import { createSelectionState } from "../selection/SelectionManager.ts";
import {
  cancelRectangleToolSession,
  createRectangleToolState,
  handleRectangleToolPointerDown,
  handleRectangleToolPointerMove,
} from "./RectangleTool.ts";
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

describe("RectangleTool", () => {
  it("previews width and height while drawing", () => {
    const start = handleRectangleToolPointerDown(
      contextAt(0, 0),
      createRectangleToolState(),
    );
    expect(start.state.phase).toBe("drawing");

    const move = handleRectangleToolPointerMove(contextAt(40, 20), start.state);
    expect(move.previewRectangle).toEqual({
      cornerA: { x: 0, y: 0 },
      cornerB: { x: 40, y: 20 },
    });
    expect(move.rectMetrics).toEqual({ widthMm: 40, heightMm: 20 });
  });

  it("creates a rectangle on the second click and returns to idle", () => {
    const start = handleRectangleToolPointerDown(
      contextAt(0, 0),
      createRectangleToolState(),
    );
    const end = handleRectangleToolPointerDown(contextAt(50, 30), start.state);

    expect(end.result.createRectangle).toEqual({
      cornerA: { x: 0, y: 0 },
      cornerB: { x: 50, y: 30 },
    });
    expect(end.state.phase).toBe("idle");
    expect(end.result.creationSessionActive).toBe(false);
  });

  it("does not create a zero-area rectangle", () => {
    const start = handleRectangleToolPointerDown(
      contextAt(0, 0),
      createRectangleToolState(),
    );
    const end = handleRectangleToolPointerDown(contextAt(40, 0), start.state);

    expect(end.result.createRectangle).toBeUndefined();
    expect(end.state.phase).toBe("drawing");
  });

  it("cancels an unfinished rectangle session", () => {
    const start = handleRectangleToolPointerDown(
      contextAt(0, 0),
      createRectangleToolState(),
    );
    const cancelled = cancelRectangleToolSession(start.state);
    expect(cancelled.cancelled).toBe(true);
    expect(cancelled.state.phase).toBe("idle");
  });
});
