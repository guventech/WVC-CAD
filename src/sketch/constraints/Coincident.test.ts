import { beforeEach, describe, expect, it } from "vitest";
import {
  createCommandHistory,
  executeCommand,
  undoCommand,
} from "../commands/Command.ts";
import {
  addCoincidentToSketch,
  createAddCoincidentCommand,
} from "../commands/AddCoincidentCommand.ts";
import {
  addCircleToSketch,
  addLineToSketch,
  addPointToSketch,
} from "../commands/CreateGeometryCommand.ts";
import { createMoveGeometryCommand } from "../commands/GeometryEdit.ts";
import { createDeleteGeometryCommand } from "../commands/DeleteGeometryCommand.ts";
import { TOLERANCE } from "../geometry/GeometryMath.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { createEmptySketch } from "../model/Sketch.ts";
import { allCoincidentSatisfied, coincidentResidual } from "./Coincident.ts";
import { maxCoincidentResidual } from "../solver/Residuals.ts";

describe("coincident constraint (Chunk 11)", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("merges two points and keeps them coincident when one moves", () => {
    let sketch = createEmptySketch();
    const a = addPointToSketch(sketch, { x: 0, y: 0 })!;
    sketch = a.sketch;
    const b = addPointToSketch(sketch, { x: 10, y: 5 })!;
    sketch = b.sketch;

    const constrained = addCoincidentToSketch(
      sketch,
      { entityId: a.point.id, role: "position" },
      { entityId: b.point.id, role: "position" },
    )!;
    expect(constrained.constraints).toHaveLength(1);

    const pointB = constrained.geometry.find((entity) => entity.id === b.point.id);
    expect(pointB?.type).toBe("point");
    if (pointB?.type === "point") {
      expect(pointB.position).toEqual({ x: 0, y: 0 });
    }
    expect(allCoincidentSatisfied(constrained)).toBe(true);

    const moved = executeCommand(
      createCommandHistory(),
      constrained,
      createMoveGeometryCommand(
        constrained,
        { kind: "point", entityId: a.point.id },
        { x: 0, y: 0 },
        { x: 40, y: 20 },
      )!,
    );

    const movedA = moved.sketch.geometry.find((entity) => entity.id === a.point.id);
    const movedB = moved.sketch.geometry.find((entity) => entity.id === b.point.id);
    expect(movedA?.type).toBe("point");
    expect(movedB?.type).toBe("point");
    if (movedA?.type === "point" && movedB?.type === "point") {
      expect(movedA.position.x).toBeCloseTo(40, 5);
      expect(movedA.position.y).toBeCloseTo(20, 5);
      expect(movedB.position.x).toBeCloseTo(40, 5);
      expect(movedB.position.y).toBeCloseTo(20, 5);
    }
    expect(maxCoincidentResidual(moved.sketch)).toBeLessThanOrEqual(
      TOLERANCE.coincidence,
    );
  });

  it("supports line endpoint ↔ circle center coincident", () => {
    let sketch = createEmptySketch();
    const line = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 30, y: 0 })!;
    sketch = line.sketch;
    const circle = addCircleToSketch(sketch, { x: 50, y: 10 }, 8)!;
    sketch = circle.sketch;

    const constrained = addCoincidentToSketch(
      sketch,
      { entityId: line.line.id, role: "end" },
      { entityId: circle.circle.id, role: "center" },
    )!;

    const updatedLine = constrained.geometry.find(
      (entity) => entity.id === line.line.id,
    );
    const updatedCircle = constrained.geometry.find(
      (entity) => entity.id === circle.circle.id,
    );
    expect(updatedLine?.type).toBe("line");
    expect(updatedCircle?.type).toBe("circle");
    if (updatedLine?.type === "line" && updatedCircle?.type === "circle") {
      expect(updatedLine.end).toEqual(updatedCircle.center);
      expect(updatedCircle.center).toEqual({ x: 30, y: 0 });
    }

    const residual = coincidentResidual(
      constrained,
      constrained.constraints[0]!,
    );
    expect(residual).toBeLessThanOrEqual(TOLERANCE.coincidence);
  });

  it("supports point ↔ line coincident (point on infinite line)", () => {
    let sketch = createEmptySketch();
    const line = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 40, y: 0 })!;
    sketch = line.sketch;
    const point = addPointToSketch(sketch, { x: 10, y: 12 })!;
    sketch = point.sketch;

    const constrained = addCoincidentToSketch(
      sketch,
      { entityId: point.point.id, role: "position" },
      { entityId: line.line.id, role: "entity" },
    )!;

    const updated = constrained.geometry.find(
      (entity) => entity.id === point.point.id,
    );
    expect(updated?.type).toBe("point");
    if (updated?.type === "point") {
      expect(updated.position.y).toBeCloseTo(0, 6);
      expect(updated.position.x).toBeCloseTo(10, 6);
    }
    expect(allCoincidentSatisfied(constrained)).toBe(true);
  });

  it("removes coincident constraints when a referenced entity is deleted", () => {
    let sketch = createEmptySketch();
    const a = addPointToSketch(sketch, { x: 0, y: 0 })!;
    sketch = a.sketch;
    const b = addPointToSketch(sketch, { x: 5, y: 0 })!;
    sketch = b.sketch;
    sketch = addCoincidentToSketch(
      sketch,
      { entityId: a.point.id, role: "position" },
      { entityId: b.point.id, role: "position" },
    )!;
    expect(sketch.constraints).toHaveLength(1);

    const deleted = executeCommand(
      createCommandHistory(),
      sketch,
      createDeleteGeometryCommand(sketch, [a.point.id])!,
    );
    expect(deleted.sketch.constraints).toHaveLength(0);
    expect(deleted.sketch.geometry).toHaveLength(1);
  });

  it("undoes adding a coincident constraint and restores geometry", () => {
    let sketch = createEmptySketch();
    const a = addPointToSketch(sketch, { x: 0, y: 0 })!;
    sketch = a.sketch;
    const b = addPointToSketch(sketch, { x: 8, y: 4 })!;
    sketch = b.sketch;

    const applied = executeCommand(
      createCommandHistory(),
      sketch,
      createAddCoincidentCommand(
        sketch,
        { entityId: a.point.id, role: "position" },
        { entityId: b.point.id, role: "position" },
      )!,
    );
    expect(applied.sketch.constraints).toHaveLength(1);

    const undone = undoCommand(applied.history, applied.sketch);
    expect(undone.sketch.constraints).toHaveLength(0);
    const restoredB = undone.sketch.geometry.find(
      (entity) => entity.id === b.point.id,
    );
    expect(restoredB?.type).toBe("point");
    if (restoredB?.type === "point") {
      expect(restoredB.position).toEqual({ x: 8, y: 4 });
    }
  });
});
