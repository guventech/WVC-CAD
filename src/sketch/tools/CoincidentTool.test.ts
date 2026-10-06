import { beforeEach, describe, expect, it } from "vitest";
import {
  addLineToSketch,
  addPointToSketch,
} from "../commands/CreateGeometryCommand.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { createEmptySketch } from "../model/Sketch.ts";
import { createSelectionState } from "../selection/SelectionManager.ts";
import { createCamera } from "../viewport/Camera.ts";
import {
  createCoincidentToolState,
  handleCoincidentToolPointerDown,
} from "./CoincidentTool.ts";
import type { ToolPointerContext } from "./ToolTypes.ts";

function contextFor(
  sketch: ReturnType<typeof createEmptySketch>,
  worldPoint: { x: number; y: number },
): ToolPointerContext {
  return {
    worldPoint,
    camera: createCamera(800, 600, 2),
    sketch,
    selection: createSelectionState(),
    modifiers: { shift: false, ctrl: false, meta: false },
  };
}

describe("CoincidentTool", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("creates a coincident request from two point picks", () => {
    let sketch = createEmptySketch();
    const a = addPointToSketch(sketch, { x: 0, y: 0 });
    sketch = a.sketch;
    const b = addPointToSketch(sketch, { x: 20, y: 0 });
    sketch = b.sketch;

    const first = handleCoincidentToolPointerDown(
      contextFor(sketch, { x: 0, y: 0 }),
      createCoincidentToolState(),
    );
    expect(first.state.phase).toBe("first-picked");
    expect(first.result.creationSessionActive).toBe(true);

    const second = handleCoincidentToolPointerDown(
      contextFor(sketch, { x: 20, y: 0 }),
      first.state,
    );
    expect(second.result.createCoincident).toEqual({
      first: { entityId: a.point.id, role: "position" },
      second: { entityId: b.point.id, role: "position" },
    });
  });

  it("allows a line edge as the second pick for point-on-line", () => {
    let sketch = createEmptySketch();
    const point = addPointToSketch(sketch, { x: 5, y: 8 });
    sketch = point.sketch;
    const line = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 40, y: 0 })!;
    sketch = line.sketch;

    const first = handleCoincidentToolPointerDown(
      contextFor(sketch, { x: 5, y: 8 }),
      createCoincidentToolState(),
    );
    const second = handleCoincidentToolPointerDown(
      contextFor(sketch, { x: 20, y: 0 }),
      first.state,
    );
    expect(second.result.createCoincident).toEqual({
      first: { entityId: point.point.id, role: "position" },
      second: { entityId: line.line.id, role: "entity" },
    });
  });
});
