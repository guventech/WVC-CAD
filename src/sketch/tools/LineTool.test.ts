import { beforeEach, describe, expect, it } from "vitest";
import { addLineToSketch } from "../commands/CreateGeometryCommand.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { createEmptySketch, type Sketch } from "../model/Sketch.ts";
import { createCamera } from "../viewport/Camera.ts";
import { createSelectionState } from "../selection/SelectionManager.ts";
import {
  cancelLineToolSegment,
  createLineToolState,
  handleLineToolPointerDown,
  handleLineToolPointerMove,
} from "./LineTool.ts";
import type { ToolPointerContext } from "./ToolTypes.ts";

function contextAt(
  x: number,
  y: number,
  sketch: Sketch = createEmptySketch(),
): ToolPointerContext {
  return {
    worldPoint: { x, y },
    camera: createCamera(800, 600, 2),
    sketch,
    selection: createSelectionState(),
    modifiers: { shift: false, ctrl: false, meta: false },
  };
}

describe("LineTool", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("starts a segment on first click and previews on move", () => {
    const start = handleLineToolPointerDown(contextAt(0, 0), createLineToolState());
    expect(start.state.phase).toBe("drawing");
    expect(start.state.start).toEqual({ x: 0, y: 0 });
    expect(start.result.creationSessionActive).toBe(true);
    expect(start.result.createLine).toBeUndefined();

    const move = handleLineToolPointerMove(contextAt(40, 0), start.state);
    expect(move.previewLine).toEqual({
      start: { x: 0, y: 0 },
      end: { x: 40, y: 0 },
    });
    expect(move.lineMetrics?.lengthMm).toBeCloseTo(40, 6);
    expect(move.lineMetrics?.angleDegrees).toBeCloseTo(0, 6);
    expect(move.activeSnap?.type).toBe("horizontal");
  });

  it("creates a line on second click and continues from the end", () => {
    const start = handleLineToolPointerDown(contextAt(10, 10), createLineToolState());
    const end = handleLineToolPointerDown(contextAt(50, 10), start.state);

    expect(end.result.createLine).toEqual({
      start: { x: 10, y: 10 },
      end: { x: 50, y: 10 },
    });
    expect(end.state.phase).toBe("drawing");
    expect(end.state.start).toEqual({ x: 50, y: 10 });
    expect(end.result.creationSessionActive).toBe(true);
  });

  it("does not create a zero-length line", () => {
    const start = handleLineToolPointerDown(contextAt(0, 0), createLineToolState());
    const end = handleLineToolPointerDown(contextAt(0, 0), start.state);

    expect(end.result.createLine).toBeUndefined();
    expect(end.state.phase).toBe("drawing");
    expect(end.state.start).toEqual({ x: 0, y: 0 });
  });

  it("reports vertical inference while aligning to start", () => {
    const start = handleLineToolPointerDown(contextAt(20, 0), createLineToolState());
    // Free Y midway between 30/40 mm grid so pure V wins (no grid combine).
    const move = handleLineToolPointerMove(contextAt(21, 35), start.state);

    expect(move.activeSnap?.type).toBe("vertical");
    expect(move.previewLine?.end).toEqual({ x: 20, y: 35 });
    expect(move.lineMetrics?.angleDegrees).toBeCloseTo(90, 5);
  });

  it("snaps the free axis to grid while horizontal", () => {
    const start = handleLineToolPointerDown(contextAt(0, 0), createLineToolState());
    const move = handleLineToolPointerMove(contextAt(37, 1), start.state);

    expect(move.activeSnap?.type).toBe("horizontal");
    expect(move.previewLine?.end).toEqual({ x: 40, y: 0 });
    expect(move.lineMetrics?.lengthMm).toBeCloseTo(40, 6);
  });

  it("cancels an unfinished segment without creating geometry", () => {
    const start = handleLineToolPointerDown(contextAt(0, 0), createLineToolState());
    const cancelled = cancelLineToolSegment(start.state);

    expect(cancelled.cancelled).toBe(true);
    expect(cancelled.state.phase).toBe("idle");
    expect(cancelled.state.start).toBeNull();
  });

  it("passes midpoint source when ending on a line midpoint snap", () => {
    const base = addLineToSketch(
      createEmptySketch(),
      { x: 0, y: 0 },
      { x: 40, y: 0 },
    )!;
    const start = handleLineToolPointerDown(
      contextAt(20, 30, base.sketch),
      createLineToolState(),
    );
    // Midpoint of base line is (20, 0).
    const end = handleLineToolPointerDown(
      contextAt(20, 0, base.sketch),
      start.state,
    );
    expect(end.result.createLine?.endMidpointOf).toBe(base.line.id);
    expect(end.result.activeSnap?.type).toBe("midpoint");
  });
});
