import { describe, expect, it } from "vitest";
import { createEmptySketch } from "../model/Sketch.ts";
import { addLineToSketch } from "../commands/CreateGeometryCommand.ts";
import { createCamera } from "../viewport/Camera.ts";
import { createSelectionState } from "../selection/SelectionManager.ts";
import {
  handleExtendToolPointerDown,
  handleTrimToolPointerDown,
} from "./TrimExtendTool.ts";
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

describe("TrimExtendTool", () => {
  it("emits trimRequest when clicking a line edge", () => {
    let sketch = createEmptySketch();
    sketch = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 100, y: 0 })!.sketch;
    sketch = addLineToSketch(sketch, { x: 40, y: -20 }, { x: 40, y: 20 })!.sketch;

    const result = handleTrimToolPointerDown(contextFor(sketch, { x: 10, y: 0 }));
    expect(result.trimRequest).toBeDefined();
    expect(result.trimRequest?.entityId).toBe(sketch.geometry[0]!.id);
    expect(result.extendRequest).toBeUndefined();
  });

  it("emits extendRequest when clicking near a line end", () => {
    let sketch = createEmptySketch();
    sketch = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 40, y: 0 })!.sketch;

    const result = handleExtendToolPointerDown(
      contextFor(sketch, { x: 38, y: 0 }),
    );
    expect(result.extendRequest).toBeDefined();
    expect(result.extendRequest?.entityId).toBe(sketch.geometry[0]!.id);
  });
});
