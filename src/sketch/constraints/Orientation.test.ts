import { beforeEach, describe, expect, it } from "vitest";
import {
  createCommandHistory,
  executeCommand,
  redoCommand,
  undoCommand,
} from "../commands/Command.ts";
import { addCoincidentToSketch } from "../commands/AddCoincidentCommand.ts";
import {
  createAddMaintainedConstraintCommand,
  prepareAddConstraint,
} from "../commands/AddMaintainedConstraintCommand.ts";
import { addLineToSketch, addPointToSketch } from "../commands/CreateGeometryCommand.ts";
import { createAddRectangleCommand } from "../commands/CreateRectangleCommand.ts";
import { createDeleteGeometryCommand } from "../commands/DeleteGeometryCommand.ts";
import {
  applyGeometryDragWithConstraints,
  createMoveGeometryCommand,
} from "../commands/GeometryEdit.ts";
import { TOLERANCE } from "../geometry/GeometryMath.ts";
import type { LineGeometry } from "../model/Geometry.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { parseRectangleFeature } from "../model/RectangleFeature.ts";
import { createEmptySketch, type Sketch } from "../model/Sketch.ts";
import { maxSupportedResidual } from "../solver/Residuals.ts";
import { listUnsatisfiedConstraints } from "./ConstraintMaintenance.ts";
import { orientationResidual } from "./Orientation.ts";

function lineOf(sketch: Sketch, id: string): LineGeometry {
  const entity = sketch.geometry.find((item) => item.id === id);
  if (entity?.type !== "line") {
    throw new Error(`line ${id} missing`);
  }
  return entity;
}

function addConstraint(
  sketch: Sketch,
  type: "horizontal" | "vertical",
  references: { entityId: string; role: "entity" | "position" | "start" | "end" }[],
): Sketch {
  const outcome = prepareAddConstraint(sketch, { type, references });
  if (!outcome.ok) {
    throw new Error(outcome.reason);
  }
  return outcome.sketch;
}

describe("horizontal / vertical constraints (Chunk 12)", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("makes a slanted line horizontal (endpoints meet at mean y)", () => {
    const created = addLineToSketch(createEmptySketch(), { x: 0, y: 0 }, { x: 40, y: 10 })!;
    const sketch = addConstraint(created.sketch, "horizontal", [
      { entityId: created.line.id, role: "entity" },
    ]);
    const line = lineOf(sketch, created.line.id);
    expect(line.start.y).toBeCloseTo(5, 6);
    expect(line.end.y).toBeCloseTo(5, 6);
    expect(line.start.x).toBeCloseTo(0, 6);
    expect(line.end.x).toBeCloseTo(40, 6);
    expect(orientationResidual(sketch, sketch.constraints[0]!)).toBeLessThanOrEqual(
      TOLERANCE.coincidence,
    );
  });

  it("makes a line vertical", () => {
    const created = addLineToSketch(createEmptySketch(), { x: 0, y: 0 }, { x: 6, y: 30 })!;
    const sketch = addConstraint(created.sketch, "vertical", [
      { entityId: created.line.id, role: "entity" },
    ]);
    const line = lineOf(sketch, created.line.id);
    expect(Math.abs(line.start.x - line.end.x)).toBeLessThan(TOLERANCE.coincidence);
  });

  it("aligns two points horizontally", () => {
    let sketch = createEmptySketch();
    const a = addPointToSketch(sketch, { x: 0, y: 0 });
    sketch = a.sketch;
    const b = addPointToSketch(sketch, { x: 20, y: 8 });
    sketch = addConstraint(b.sketch, "horizontal", [
      { entityId: a.point.id, role: "position" },
      { entityId: b.point.id, role: "position" },
    ]);
    expect(maxSupportedResidual(sketch)).toBeLessThanOrEqual(TOLERANCE.coincidence);
  });

  it("keeps a horizontal line horizontal while an endpoint is dragged; undo/redo", () => {
    const created = addLineToSketch(createEmptySketch(), { x: 0, y: 0 }, { x: 40, y: 0 })!;
    const sketch = addConstraint(created.sketch, "horizontal", [
      { entityId: created.line.id, role: "entity" },
    ]);

    const command = createMoveGeometryCommand(
      sketch,
      { kind: "line-endpoint", entityId: created.line.id, which: "end" },
      { x: 40, y: 0 },
      { x: 55, y: 17 },
    )!;
    const moved = executeCommand(createCommandHistory(), sketch, command);
    const line = lineOf(moved.sketch, created.line.id);
    expect(line.end).toEqual({ x: 55, y: 17 });
    expect(line.start.y).toBeCloseTo(17, 9);
    expect(line.start.x).toBeCloseTo(0, 9);

    const undone = undoCommand(moved.history, moved.sketch);
    expect(lineOf(undone.sketch, created.line.id).end).toEqual({ x: 40, y: 0 });
    expect(lineOf(undone.sketch, created.line.id).start).toEqual({ x: 0, y: 0 });

    const redone = redoCommand(undone.history, undone.sketch);
    expect(lineOf(redone.sketch, created.line.id).start.y).toBeCloseTo(17, 9);
  });

  it("line-body drag keeps a horizontal line horizontal", () => {
    const created = addLineToSketch(createEmptySketch(), { x: 0, y: 0 }, { x: 40, y: 0 })!;
    const sketch = addConstraint(created.sketch, "horizontal", [
      { entityId: created.line.id, role: "entity" },
    ]);
    const moved = applyGeometryDragWithConstraints(
      sketch,
      {
        kind: "line-body",
        entityId: created.line.id,
        grabOffset: { x: 20, y: 0 },
        span: { x: 40, y: 0 },
      },
      { x: 30, y: 12 },
    );
    const line = lineOf(moved, created.line.id);
    expect(line.start).toEqual({ x: 10, y: 12 });
    expect(line.end).toEqual({ x: 50, y: 12 });
  });

  it("propagates through a coincident corner: H line + V line", () => {
    let sketch = createEmptySketch();
    const a = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 40, y: 0 })!;
    sketch = a.sketch;
    const b = addLineToSketch(sketch, { x: 40, y: 0 }, { x: 40, y: 30 })!;
    sketch = b.sketch;
    sketch = addCoincidentToSketch(
      sketch,
      { entityId: a.line.id, role: "end" },
      { entityId: b.line.id, role: "start" },
    )!;
    sketch = addConstraint(sketch, "horizontal", [{ entityId: a.line.id, role: "entity" }]);
    sketch = addConstraint(sketch, "vertical", [{ entityId: b.line.id, role: "entity" }]);

    const moved = applyGeometryDragWithConstraints(
      sketch,
      { kind: "line-endpoint", entityId: b.line.id, which: "end" },
      { x: 60, y: 45 },
    );
    expect(moved).not.toBe(sketch);
    const lineA = lineOf(moved, a.line.id);
    const lineB = lineOf(moved, b.line.id);
    expect(lineB.end).toEqual({ x: 60, y: 45 });
    expect(Math.abs(lineA.start.y - lineA.end.y)).toBeLessThan(TOLERANCE.coincidence);
    expect(Math.abs(lineB.start.x - lineB.end.x)).toBeLessThan(TOLERANCE.coincidence);
    expect(listUnsatisfiedConstraints(moved)).toEqual([]);
  });

  it("rejects vertical on a horizontal line and leaves the sketch unchanged", () => {
    const created = addLineToSketch(createEmptySketch(), { x: 0, y: 0 }, { x: 40, y: 0 })!;
    const sketch = addConstraint(created.sketch, "horizontal", [
      { entityId: created.line.id, role: "entity" },
    ]);
    const outcome = createAddMaintainedConstraintCommand(sketch, {
      type: "vertical",
      references: [{ entityId: created.line.id, role: "entity" }],
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toMatch(/both horizontal and vertical/);
    }
  });

  it("rejects a duplicate horizontal on a rectangle edge", () => {
    const sketch = createAddRectangleCommand({ x: 0, y: 0 }, { x: 40, y: 20 })!.apply(
      createEmptySketch(),
    );
    const feature = sketch.constraints
      .map(parseRectangleFeature)
      .find((item) => item !== null)!;
    const outcome = prepareAddConstraint(sketch, {
      type: "horizontal",
      references: [{ entityId: feature.edges.bottom, role: "entity" }],
    });
    expect(outcome.ok).toBe(false);
  });

  it("rejects a point pair H constraint that conflicts via a vertical line", () => {
    const created = addLineToSketch(createEmptySketch(), { x: 0, y: 0 }, { x: 0, y: 30 })!;
    const sketch = addConstraint(created.sketch, "vertical", [
      { entityId: created.line.id, role: "entity" },
    ]);
    const outcome = prepareAddConstraint(sketch, {
      type: "horizontal",
      references: [
        { entityId: created.line.id, role: "start" },
        { entityId: created.line.id, role: "end" },
      ],
    });
    expect(outcome.ok).toBe(false);
  });

  it("removes H constraints when the line is deleted; undo restores both", () => {
    const created = addLineToSketch(createEmptySketch(), { x: 0, y: 0 }, { x: 40, y: 3 })!;
    const sketch = addConstraint(created.sketch, "horizontal", [
      { entityId: created.line.id, role: "entity" },
    ]);
    const deleted = executeCommand(
      createCommandHistory(),
      sketch,
      createDeleteGeometryCommand(sketch, [created.line.id])!,
    );
    expect(deleted.sketch.constraints).toHaveLength(0);
    const undone = undoCommand(deleted.history, deleted.sketch);
    expect(undone.sketch.constraints).toHaveLength(1);
    expect(undone.sketch.geometry).toHaveLength(1);
  });
});
