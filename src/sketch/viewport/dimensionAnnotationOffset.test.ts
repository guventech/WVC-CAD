import { beforeEach, describe, expect, it } from "vitest";
import { createAddMaintainedConstraintCommand } from "../commands/AddMaintainedConstraintCommand.ts";
import { createAddRectangleCommand } from "../commands/CreateRectangleCommand.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { parseRectangleFeature } from "../model/RectangleFeature.ts";
import { createEmptySketch } from "../model/Sketch.ts";
import {
  constrainDimensionAnnotationOffset,
  dimensionAnnotationMoveAxis,
} from "./dimensionAnnotationOffset.ts";

describe("dimensionAnnotationOffset", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("moves horizontal length dims only along ±Y", () => {
    let sketch = createAddRectangleCommand(
      { x: 0, y: 0 },
      { x: 80, y: 40 },
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
    const axis = dimensionAnnotationMoveAxis(sketch, length)!;
    expect(Math.abs(axis.x)).toBeLessThan(1e-9);
    expect(Math.abs(Math.abs(axis.y) - 1)).toBeLessThan(1e-9);
    expect(
      constrainDimensionAnnotationOffset(sketch, length, { x: 9, y: -14 }),
    ).toEqual({ x: 0, y: -14 });
  });

  it("moves vertical length dims only along ±X", () => {
    let sketch = createAddRectangleCommand(
      { x: 0, y: 0 },
      { x: 80, y: 40 },
    )!.apply(createEmptySketch());
    const rect = parseRectangleFeature(
      sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;
    const add = createAddMaintainedConstraintCommand(sketch, {
      type: "length",
      references: [{ entityId: rect.edges.right, role: "entity" }],
    });
    expect(add.ok).toBe(true);
    if (!add.ok) {
      return;
    }
    sketch = add.command.apply(sketch);
    const length = sketch.constraints.find((c) => c.type === "length")!;
    const constrained = constrainDimensionAnnotationOffset(sketch, length, {
      x: 11,
      y: 6,
    });
    expect(constrained.y).toBeCloseTo(0, 10);
    expect(Math.abs(constrained.x)).toBeCloseTo(11, 10);
  });

  it("keeps horizontal-distance on ±Y even when endpoints are diagonal", () => {
    let sketch = createAddRectangleCommand(
      { x: 0, y: 0 },
      { x: 80, y: 40 },
    )!.apply(createEmptySketch());
    const rect = parseRectangleFeature(
      sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;
    expect(rect.corners.bl).not.toBeNull();
    expect(rect.corners.tr).not.toBeNull();
    if (rect.corners.bl === null || rect.corners.tr === null) {
      return;
    }
    const add = createAddMaintainedConstraintCommand(sketch, {
      type: "horizontal-distance",
      references: [
        { entityId: rect.corners.bl, role: "entity" },
        { entityId: rect.corners.tr, role: "entity" },
      ],
      value: 80,
      driving: true,
    });
    expect(add.ok).toBe(true);
    if (!add.ok) {
      return;
    }
    sketch = add.command.apply(sketch);
    const dim = sketch.constraints.find((c) => c.type === "horizontal-distance")!;
    expect(dimensionAnnotationMoveAxis(sketch, dim)).toEqual({ x: 0, y: 1 });
    expect(
      constrainDimensionAnnotationOffset(sketch, dim, { x: 4, y: 20 }),
    ).toEqual({ x: 0, y: 20 });
  });
});
