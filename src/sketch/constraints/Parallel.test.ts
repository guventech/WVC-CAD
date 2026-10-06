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
import { addLineToSketch } from "../commands/CreateGeometryCommand.ts";
import {
  applyGeometryDragWithConstraints,
  createMoveGeometryCommand,
} from "../commands/GeometryEdit.ts";
import { TOLERANCE } from "../geometry/GeometryMath.ts";
import type { LineGeometry } from "../model/Geometry.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { DATUM_AXIS_X_ID, DATUM_AXIS_Y_ID } from "../model/SketchFrame.ts";
import { createEmptySketch, type Sketch } from "../model/Sketch.ts";
import { analyzeDegreesOfFreedom } from "./DegreesOfFreedom.ts";
import { listUnsatisfiedConstraints } from "./ConstraintMaintenance.ts";
import { lineRelationResidual } from "./Parallel.ts";
import { solve } from "../solver/Solver.ts";

function lineOf(sketch: Sketch, id: string): LineGeometry {
  const entity = sketch.geometry.find((item) => item.id === id);
  if (entity?.type !== "line") {
    throw new Error(`line ${id} missing`);
  }
  return entity;
}

function addRelation(
  sketch: Sketch,
  type: "parallel" | "perpendicular",
  firstId: string,
  secondId: string,
): Sketch {
  const outcome = prepareAddConstraint(sketch, {
    type,
    references: [
      { entityId: firstId, role: "entity" },
      { entityId: secondId, role: "entity" },
    ],
  });
  if (!outcome.ok) {
    throw new Error(outcome.reason);
  }
  return outcome.sketch;
}

function crossAbs(a: LineGeometry, b: LineGeometry): number {
  const ax = a.end.x - a.start.x;
  const ay = a.end.y - a.start.y;
  const bx = b.end.x - b.start.x;
  const by = b.end.y - b.start.y;
  const la = Math.hypot(ax, ay);
  const lb = Math.hypot(bx, by);
  return Math.abs((ax * by - ay * bx) / (la * lb));
}

function dotAbs(a: LineGeometry, b: LineGeometry): number {
  const ax = a.end.x - a.start.x;
  const ay = a.end.y - a.start.y;
  const bx = b.end.x - b.start.x;
  const by = b.end.y - b.start.y;
  const la = Math.hypot(ax, ay);
  const lb = Math.hypot(bx, by);
  return Math.abs((ax * bx + ay * by) / (la * lb));
}

describe("parallel / perpendicular constraints", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("makes two slanted lines parallel", () => {
    let sketch = createEmptySketch();
    const a = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 40, y: 10 })!;
    sketch = a.sketch;
    const b = addLineToSketch(sketch, { x: 0, y: 20 }, { x: 30, y: 35 })!;
    sketch = addRelation(b.sketch, "parallel", a.line.id, b.line.id);

    const lineA = lineOf(sketch, a.line.id);
    const lineB = lineOf(sketch, b.line.id);
    expect(crossAbs(lineA, lineB)).toBeLessThan(TOLERANCE.angular);
    expect(lineRelationResidual(sketch, sketch.constraints[0]!)).toBeLessThanOrEqual(
      TOLERANCE.angular,
    );
    expect(listUnsatisfiedConstraints(sketch)).toEqual([]);
  });

  it("makes two lines perpendicular", () => {
    let sketch = createEmptySketch();
    const a = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 40, y: 0 })!;
    sketch = a.sketch;
    const b = addLineToSketch(sketch, { x: 10, y: 0 }, { x: 25, y: 20 })!;
    sketch = addRelation(b.sketch, "perpendicular", a.line.id, b.line.id);

    const lineA = lineOf(sketch, a.line.id);
    const lineB = lineOf(sketch, b.line.id);
    expect(dotAbs(lineA, lineB)).toBeLessThan(TOLERANCE.angular);
    expect(solve(sketch).status).toBe("under-constrained");
  });

  it("parallel between two user lines keeps the first-picked line fixed", () => {
    let sketch = createEmptySketch();
    const a = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 40, y: 10 })!;
    sketch = a.sketch;
    const b = addLineToSketch(sketch, { x: 5, y: 0 }, { x: 25, y: 30 })!;
    const beforeA = { ...a.line };
    sketch = addRelation(b.sketch, "parallel", a.line.id, b.line.id);

    const lineA = lineOf(sketch, a.line.id);
    const lineB = lineOf(sketch, b.line.id);
    expect(lineA.start.x).toBeCloseTo(beforeA.start.x, 6);
    expect(lineA.start.y).toBeCloseTo(beforeA.start.y, 6);
    expect(lineA.end.x).toBeCloseTo(beforeA.end.x, 6);
    expect(lineA.end.y).toBeCloseTo(beforeA.end.y, 6);
    expect(crossAbs(lineA, lineB)).toBeLessThan(TOLERANCE.angular);
  });

  it("parallel to world X-axis forces a horizontal line", () => {
    const created = addLineToSketch(
      createEmptySketch(),
      { x: 5, y: 5 },
      { x: 45, y: 20 },
    )!;
    const sketch = addRelation(
      created.sketch,
      "parallel",
      created.line.id,
      DATUM_AXIS_X_ID,
    );
    const line = lineOf(sketch, created.line.id);
    expect(Math.abs(line.start.y - line.end.y)).toBeLessThan(TOLERANCE.coincidence);
  });

  it("perpendicular to world X-axis forces a vertical line", () => {
    const created = addLineToSketch(
      createEmptySketch(),
      { x: 5, y: 5 },
      { x: 25, y: 30 },
    )!;
    const sketch = addRelation(
      created.sketch,
      "perpendicular",
      created.line.id,
      DATUM_AXIS_X_ID,
    );
    const line = lineOf(sketch, created.line.id);
    expect(Math.abs(line.start.x - line.end.x)).toBeLessThan(TOLERANCE.coincidence);
  });

  it("keeps parallel while an endpoint is dragged; undo/redo", () => {
    let sketch = createEmptySketch();
    const a = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 40, y: 0 })!;
    sketch = a.sketch;
    const b = addLineToSketch(sketch, { x: 0, y: 15 }, { x: 40, y: 15 })!;
    sketch = addRelation(b.sketch, "parallel", a.line.id, b.line.id);

    const command = createMoveGeometryCommand(
      sketch,
      { kind: "line-endpoint", entityId: b.line.id, which: "end" },
      { x: 40, y: 15 },
      { x: 55, y: 40 },
    )!;
    const moved = executeCommand(createCommandHistory(), sketch, command);
    const lineA = lineOf(moved.sketch, a.line.id);
    const lineB = lineOf(moved.sketch, b.line.id);
    expect(crossAbs(lineA, lineB)).toBeLessThan(1e-5);
    expect(listUnsatisfiedConstraints(moved.sketch)).toEqual([]);

    const undone = undoCommand(moved.history, moved.sketch);
    expect(lineOf(undone.sketch, b.line.id).end).toEqual({ x: 40, y: 15 });

    const redone = redoCommand(undone.history, undone.sketch);
    expect(crossAbs(
      lineOf(redone.sketch, a.line.id),
      lineOf(redone.sketch, b.line.id),
    )).toBeLessThan(1e-5);
  });

  it("line-body drag keeps perpendicular", () => {
    let sketch = createEmptySketch();
    const a = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 40, y: 0 })!;
    sketch = a.sketch;
    const b = addLineToSketch(sketch, { x: 20, y: 0 }, { x: 20, y: 30 })!;
    sketch = addRelation(b.sketch, "perpendicular", a.line.id, b.line.id);

    const moved = applyGeometryDragWithConstraints(
      sketch,
      {
        kind: "line-body",
        entityId: b.line.id,
        grabOffset: { x: 20, y: 15 },
        span: { x: 0, y: 30 },
      },
      { x: 35, y: 20 },
    );
    expect(dotAbs(lineOf(moved, a.line.id), lineOf(moved, b.line.id))).toBeLessThan(
      TOLERANCE.angular,
    );
  });

  it("rejects parallel + perpendicular on the same pair", () => {
    let sketch = createEmptySketch();
    const a = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 40, y: 0 })!;
    sketch = a.sketch;
    const b = addLineToSketch(sketch, { x: 0, y: 10 }, { x: 40, y: 10 })!;
    sketch = addRelation(b.sketch, "parallel", a.line.id, b.line.id);

    const outcome = createAddMaintainedConstraintCommand(sketch, {
      type: "perpendicular",
      references: [
        { entityId: a.line.id, role: "entity" },
        { entityId: b.line.id, role: "entity" },
      ],
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toMatch(/both parallel and perpendicular/);
    }
  });

  it("rejects a duplicate parallel", () => {
    let sketch = createEmptySketch();
    const a = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 40, y: 0 })!;
    sketch = a.sketch;
    const b = addLineToSketch(sketch, { x: 0, y: 10 }, { x: 40, y: 10 })!;
    sketch = addRelation(b.sketch, "parallel", a.line.id, b.line.id);

    const outcome = createAddMaintainedConstraintCommand(sketch, {
      type: "parallel",
      references: [
        { entityId: b.line.id, role: "entity" },
        { entityId: a.line.id, role: "entity" },
      ],
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toMatch(/equivalent parallel/);
    }
  });

  it("rejects parallel to both world axes (incompatible)", () => {
    const created = addLineToSketch(
      createEmptySketch(),
      { x: 0, y: 0 },
      { x: 40, y: 0 },
    )!;
    let sketch = addRelation(
      created.sketch,
      "parallel",
      created.line.id,
      DATUM_AXIS_X_ID,
    );
    const outcome = createAddMaintainedConstraintCommand(sketch, {
      type: "parallel",
      references: [
        { entityId: created.line.id, role: "entity" },
        { entityId: DATUM_AXIS_Y_ID, role: "entity" },
      ],
    });
    expect(outcome.ok).toBe(false);
  });

  it("removes one DOF when two free lines become parallel", () => {
    let sketch = createEmptySketch();
    const a = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 40, y: 0 })!;
    sketch = a.sketch;
    const b = addLineToSketch(sketch, { x: 0, y: 10 }, { x: 30, y: 20 })!;
    sketch = b.sketch;
    const before = analyzeDegreesOfFreedom(sketch).degreesOfFreedom;
    sketch = addRelation(sketch, "parallel", a.line.id, b.line.id);
    const after = analyzeDegreesOfFreedom(sketch).degreesOfFreedom;
    expect(before - after).toBe(1);
  });
});
