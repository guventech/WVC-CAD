import { beforeEach, describe, expect, it } from "vitest";
import { createAddRectangleCommand } from "./CreateRectangleCommand.ts";
import { createAddMaintainedConstraintCommand } from "./AddMaintainedConstraintCommand.ts";
import { createSetDimensionAnnotationCommand } from "./SetDimensionAnnotationCommand.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { parseRectangleFeature } from "../model/RectangleFeature.ts";
import { createEmptySketch } from "../model/Sketch.ts";

describe("SetDimensionAnnotationCommand", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("stores a world-mm label offset without changing the measured value", () => {
    let sketch = createAddRectangleCommand(
      { x: 0, y: 0 },
      { x: 40, y: 20 },
    )!.apply(createEmptySketch());
    const rect = parseRectangleFeature(
      sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;
    const add = createAddMaintainedConstraintCommand(sketch, {
      type: "length",
      references: [{ entityId: rect.edges.bottom, role: "entity" }],
    });
    expect(add.ok).toBe(true);
    if (!add.ok) {
      return;
    }
    sketch = add.command.apply(sketch);
    const length = sketch.constraints.find((c) => c.type === "length")!;
    const beforeValue = length.value;

    const move = createSetDimensionAnnotationCommand(sketch, length.id, {
      x: 5,
      y: -8,
    });
    expect(move.ok).toBe(true);
    if (!move.ok) {
      return;
    }
    const applied = move.command.apply(sketch);
    const updated = applied.constraints.find((c) => c.id === length.id)!;
    expect(updated.value).toBe(beforeValue);
    // Bottom edge is horizontal → only ±Y is kept.
    expect(updated.annotation?.labelOffset).toEqual({ x: 0, y: -8 });

    const afterUndo = move.command.undo(applied);
    expect(
      afterUndo.constraints.find((c) => c.id === length.id)?.annotation
        ?.labelOffset,
    ).toBeUndefined();
  });
});
