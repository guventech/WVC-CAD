import { beforeEach, describe, expect, it } from "vitest";
import {
  createCommandHistory,
  executeCommand,
  redoCommand,
  undoCommand,
} from "../commands/Command.ts";
import {
  createAddMaintainedConstraintCommand,
  prepareAddConstraint,
} from "../commands/AddMaintainedConstraintCommand.ts";
import {
  addCircleToSketch,
  addLineToSketch,
  addPointToSketch,
} from "../commands/CreateGeometryCommand.ts";
import {
  applyGeometryDragWithConstraints,
  createMoveGeometryCommand,
} from "../commands/GeometryEdit.ts";
import { TOLERANCE } from "../geometry/GeometryMath.ts";
import type { LineGeometry, PointGeometry } from "../model/Geometry.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { createEmptySketch, type Sketch } from "../model/Sketch.ts";
import { analyzeDegreesOfFreedom } from "./DegreesOfFreedom.ts";
import { listUnsatisfiedConstraints } from "./ConstraintMaintenance.ts";
import { midpointResidual } from "./Midpoint.ts";
import { solve } from "../solver/Solver.ts";

function lineOf(sketch: Sketch, id: string): LineGeometry {
  const entity = sketch.geometry.find((item) => item.id === id);
  if (entity?.type !== "line") {
    throw new Error(`line ${id} missing`);
  }
  return entity;
}

function pointOf(sketch: Sketch, id: string): PointGeometry {
  const entity = sketch.geometry.find((item) => item.id === id);
  if (entity?.type !== "point") {
    throw new Error(`point ${id} missing`);
  }
  return entity;
}

function addMidpoint(
  sketch: Sketch,
  pointId: string,
  lineId: string,
  pointRole: "position" | "center" | "start" | "end" = "position",
): Sketch {
  const outcome = prepareAddConstraint(sketch, {
    type: "midpoint",
    references: [
      { entityId: pointId, role: pointRole },
      { entityId: lineId, role: "entity" },
    ],
  });
  if (!outcome.ok) {
    throw new Error(outcome.reason);
  }
  return outcome.sketch;
}

describe("midpoint constraint", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("places a free point at the midpoint of a line", () => {
    let sketch = createEmptySketch();
    const line = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 40, y: 20 })!;
    sketch = line.sketch;
    const point = addPointToSketch(sketch, { x: 5, y: 5 });
    sketch = addMidpoint(point.sketch, point.point.id, line.line.id);

    const p = pointOf(sketch, point.point.id);
    const l = lineOf(sketch, line.line.id);
    expect(p.position.x).toBeCloseTo((l.start.x + l.end.x) / 2, 6);
    expect(p.position.y).toBeCloseTo((l.start.y + l.end.y) / 2, 6);
    expect(midpointResidual(sketch, sketch.constraints[0]!)).toBeLessThanOrEqual(
      TOLERANCE.coincidence,
    );
    expect(listUnsatisfiedConstraints(sketch)).toEqual([]);
  });

  it("accepts line then point order", () => {
    let sketch = createEmptySketch();
    const line = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 50, y: 0 })!;
    sketch = line.sketch;
    const point = addPointToSketch(sketch, { x: 10, y: 10 });
    const outcome = prepareAddConstraint(point.sketch, {
      type: "midpoint",
      references: [
        { entityId: line.line.id, role: "entity" },
        { entityId: point.point.id, role: "position" },
      ],
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }
    const p = pointOf(outcome.sketch, point.point.id);
    const l = lineOf(outcome.sketch, line.line.id);
    expect(p.position.x).toBeCloseTo((l.start.x + l.end.x) / 2, 5);
    expect(p.position.y).toBeCloseTo((l.start.y + l.end.y) / 2, 5);
  });

  it("keeps a circle center at a line midpoint while the line moves", () => {
    let sketch = createEmptySketch();
    const line = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 40, y: 0 })!;
    sketch = line.sketch;
    const circle = addCircleToSketch(sketch, { x: 20, y: 0 }, 8)!;
    sketch = addMidpoint(
      circle.sketch,
      circle.circle.id,
      line.line.id,
      "center",
    );

    const moved = applyGeometryDragWithConstraints(
      sketch,
      {
        kind: "line-body",
        entityId: line.line.id,
        grabOffset: { x: 20, y: 0 },
        span: { x: 40, y: 0 },
      },
      { x: 20, y: 15 },
    );
    const l = lineOf(moved, line.line.id);
    const c = moved.geometry.find((item) => item.id === circle.circle.id);
    expect(c?.type).toBe("circle");
    if (c?.type !== "circle") {
      return;
    }
    expect(c.center.x).toBeCloseTo((l.start.x + l.end.x) / 2, 5);
    expect(c.center.y).toBeCloseTo((l.start.y + l.end.y) / 2, 5);
  });

  it("keeps midpoint while the point is dragged; undo/redo", () => {
    let sketch = createEmptySketch();
    const line = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 40, y: 0 })!;
    sketch = line.sketch;
    const point = addPointToSketch(sketch, { x: 20, y: 0 });
    sketch = addMidpoint(point.sketch, point.point.id, line.line.id);

    const command = createMoveGeometryCommand(
      sketch,
      { kind: "point", entityId: point.point.id },
      { x: 20, y: 0 },
      { x: 30, y: 25 },
    )!;
    const moved = executeCommand(createCommandHistory(), sketch, command);
    const p = pointOf(moved.sketch, point.point.id);
    const l = lineOf(moved.sketch, line.line.id);
    expect(p.position.x).toBeCloseTo((l.start.x + l.end.x) / 2, 5);
    expect(p.position.y).toBeCloseTo((l.start.y + l.end.y) / 2, 5);
    expect(listUnsatisfiedConstraints(moved.sketch)).toEqual([]);

    const undone = undoCommand(moved.history, moved.sketch);
    expect(pointOf(undone.sketch, point.point.id).position.y).toBeCloseTo(0, 5);

    const redone = redoCommand(undone.history, undone.sketch);
    expect(listUnsatisfiedConstraints(redone.sketch)).toEqual([]);
  });

  it("rejects midpoint using an endpoint of the same line", () => {
    const created = addLineToSketch(
      createEmptySketch(),
      { x: 0, y: 0 },
      { x: 40, y: 0 },
    )!;
    const outcome = createAddMaintainedConstraintCommand(created.sketch, {
      type: "midpoint",
      references: [
        { entityId: created.line.id, role: "start" },
        { entityId: created.line.id, role: "entity" },
      ],
    });
    expect(outcome.ok).toBe(false);
  });

  it("rejects a duplicate midpoint", () => {
    let sketch = createEmptySketch();
    const line = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 40, y: 0 })!;
    sketch = line.sketch;
    const point = addPointToSketch(sketch, { x: 20, y: 0 });
    sketch = addMidpoint(point.sketch, point.point.id, line.line.id);

    const outcome = createAddMaintainedConstraintCommand(sketch, {
      type: "midpoint",
      references: [
        { entityId: line.line.id, role: "entity" },
        { entityId: point.point.id, role: "position" },
      ],
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toMatch(/equivalent midpoint/);
    }
  });

  it("removes 2 DOF for a free point on a free line midpoint", () => {
    let sketch = createEmptySketch();
    const line = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 40, y: 0 })!;
    sketch = line.sketch;
    const point = addPointToSketch(sketch, { x: 10, y: 10 });
    sketch = point.sketch;
    const before = analyzeDegreesOfFreedom(sketch).degreesOfFreedom;
    sketch = addMidpoint(sketch, point.point.id, line.line.id);
    const after = analyzeDegreesOfFreedom(sketch).degreesOfFreedom;
    expect(before - after).toBe(2);
    expect(solve(sketch).status).toBe("under-constrained");
  });
});
