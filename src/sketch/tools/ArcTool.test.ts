import { describe, expect, it } from "vitest";
import { createCamera } from "../viewport/Camera.ts";
import { createEmptySketch } from "../model/Sketch.ts";
import { createSelectionState } from "../selection/SelectionManager.ts";
import {
  cancelArcToolSession,
  createArcToolState,
  handleArcToolPointerDown,
  handleArcToolPointerMove,
} from "./ArcTool.ts";
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

describe("ArcTool", () => {
  it("previews radius after center, then CCW sweep after start", () => {
    const center = handleArcToolPointerDown(
      contextAt(0, 0),
      createArcToolState(),
    );
    expect(center.state.phase).toBe("centerSet");

    const startMove = handleArcToolPointerMove(contextAt(40, 0), center.state);
    expect(startMove.circleRadiusMm).toBeCloseTo(40);
    expect(startMove.previewArc?.showFullCircleGuide).toBe(true);

    const start = handleArcToolPointerDown(contextAt(40, 0), center.state);
    expect(start.state.phase).toBe("startSet");

    const endMove = handleArcToolPointerMove(contextAt(0, 40), start.state);
    expect(endMove.circleRadiusMm).toBeCloseTo(40);
    expect(endMove.arcSweepDegrees).toBeCloseTo(90, 0);
    expect(endMove.previewArc?.showFullCircleGuide).toBe(false);
  });

  it("creates an arc with center, start, and end clicks", () => {
    const center = handleArcToolPointerDown(
      contextAt(0, 0),
      createArcToolState(),
    );
    const start = handleArcToolPointerDown(contextAt(40, 0), center.state);
    const end = handleArcToolPointerDown(contextAt(0, 40), start.state);

    expect(end.result.createArc).toEqual({
      center: { x: 0, y: 0 },
      startPoint: { x: 40, y: 0 },
      endPoint: { x: 0, y: 40 },
    });
    expect(end.result.creationSessionActive).toBe(false);
    expect(end.state.phase).toBe("idle");
  });

  it("rejects zero radius and zero sweep", () => {
    const center = handleArcToolPointerDown(
      contextAt(0, 0),
      createArcToolState(),
    );
    const zeroRadius = handleArcToolPointerDown(contextAt(0, 0), center.state);
    expect(zeroRadius.state.phase).toBe("centerSet");
    expect(zeroRadius.result.createArc).toBeUndefined();

    const start = handleArcToolPointerDown(contextAt(30, 0), center.state);
    const zeroSweep = handleArcToolPointerDown(contextAt(30, 0), start.state);
    expect(zeroSweep.state.phase).toBe("startSet");
    expect(zeroSweep.result.createArc).toBeUndefined();
  });

  it("cancels an in-progress session", () => {
    const center = handleArcToolPointerDown(
      contextAt(0, 0),
      createArcToolState(),
    );
    const cancelled = cancelArcToolSession(center.state);
    expect(cancelled.cancelled).toBe(true);
    expect(cancelled.state.phase).toBe("idle");
  });

  it("supports arcs crossing 0° (start in Q4, end in Q1)", () => {
    const center = handleArcToolPointerDown(
      contextAt(0, 0),
      createArcToolState(),
    );
    const start = handleArcToolPointerDown(contextAt(0, -40), center.state);
    const end = handleArcToolPointerDown(contextAt(40, 0), start.state);
    expect(end.result.createArc).toBeDefined();
    expect(end.result.createArc?.startPoint).toEqual({ x: 0, y: -40 });
    expect(end.result.createArc?.endPoint).toEqual({ x: 40, y: 0 });
  });
});
