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
  addLineToSketch,
  addPointToSketch,
} from "../commands/CreateGeometryCommand.ts";
import { createMoveGeometryCommand } from "../commands/GeometryEdit.ts";
import { TOLERANCE } from "../geometry/GeometryMath.ts";
import type { PointGeometry } from "../model/Geometry.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { createEmptySketch, type Sketch } from "../model/Sketch.ts";
import { DATUM_AXIS_Y_ID } from "../model/SketchFrame.ts";
import { analyzeDegreesOfFreedom } from "./DegreesOfFreedom.ts";
import { listUnsatisfiedConstraints } from "./ConstraintMaintenance.ts";
import { symmetricResidual } from "./Symmetric.ts";
import { solve } from "../solver/Solver.ts";

function pointOf(sketch: Sketch, id: string): PointGeometry {
  const entity = sketch.geometry.find((item) => item.id === id);
  if (entity?.type !== "point") {
    throw new Error(`point ${id} missing`);
  }
  return entity;
}

function addSymmetric(
  sketch: Sketch,
  firstId: string,
  secondId: string,
  axisId: string,
): Sketch {
  const outcome = prepareAddConstraint(sketch, {
    type: "symmetric",
    references: [
      { entityId: firstId, role: "position" },
      { entityId: secondId, role: "position" },
      { entityId: axisId, role: "entity" },
    ],
  });
  if (!outcome.ok) {
    throw new Error(outcome.reason);
  }
  return outcome.sketch;
}

describe("symmetric constraint", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("mirrors two free points across the world Y-axis", () => {
    let sketch = createEmptySketch();
    const a = addPointToSketch(sketch, { x: 20, y: 10 });
    sketch = a.sketch;
    const b = addPointToSketch(sketch, { x: -5, y: 4 });
    sketch = addSymmetric(b.sketch, a.point.id, b.point.id, DATUM_AXIS_Y_ID);

    const pa = pointOf(sketch, a.point.id).position;
    const pb = pointOf(sketch, b.point.id).position;
    expect(pb.x).toBeCloseTo(-pa.x, 6);
    expect(pb.y).toBeCloseTo(pa.y, 6);
    expect(symmetricResidual(sketch, sketch.constraints[0]!)).toBeLessThanOrEqual(
      TOLERANCE.coincidence,
    );
    expect(listUnsatisfiedConstraints(sketch)).toEqual([]);
  });

  it("mirrors across a user construction line", () => {
    let sketch = createEmptySketch();
    const axis = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 0, y: 50 })!;
    sketch = axis.sketch;
    const a = addPointToSketch(sketch, { x: 15, y: 8 });
    sketch = a.sketch;
    const b = addPointToSketch(sketch, { x: 3, y: 20 });
    sketch = addSymmetric(b.sketch, a.point.id, b.point.id, axis.line.id);

    expect(symmetricResidual(sketch, sketch.constraints[0]!)).toBeLessThanOrEqual(
      TOLERANCE.coincidence,
    );
    expect(listUnsatisfiedConstraints(sketch)).toEqual([]);
  });

  it("keeps symmetry while one point is dragged; undo/redo", () => {
    let sketch = createEmptySketch();
    const a = addPointToSketch(sketch, { x: 10, y: 0 });
    sketch = a.sketch;
    const b = addPointToSketch(sketch, { x: -10, y: 0 });
    sketch = addSymmetric(b.sketch, a.point.id, b.point.id, DATUM_AXIS_Y_ID);

    const command = createMoveGeometryCommand(
      sketch,
      { kind: "point", entityId: a.point.id },
      { x: 10, y: 0 },
      { x: 25, y: 12 },
    )!;
    const moved = executeCommand(createCommandHistory(), sketch, command);
    const pa = pointOf(moved.sketch, a.point.id).position;
    const pb = pointOf(moved.sketch, b.point.id).position;
    expect(pb.x).toBeCloseTo(-pa.x, 5);
    expect(pb.y).toBeCloseTo(pa.y, 5);
    expect(listUnsatisfiedConstraints(moved.sketch)).toEqual([]);

    const undone = undoCommand(moved.history, moved.sketch);
    expect(pointOf(undone.sketch, a.point.id).position).toEqual({ x: 10, y: 0 });

    const redone = redoCommand(undone.history, undone.sketch);
    const ra = pointOf(redone.sketch, a.point.id).position;
    const rb = pointOf(redone.sketch, b.point.id).position;
    expect(rb.x).toBeCloseTo(-ra.x, 5);
    expect(rb.y).toBeCloseTo(ra.y, 5);
  });

  it("rejects a duplicate symmetric", () => {
    let sketch = createEmptySketch();
    const a = addPointToSketch(sketch, { x: 10, y: 5 });
    sketch = a.sketch;
    const b = addPointToSketch(sketch, { x: -10, y: 5 });
    sketch = addSymmetric(b.sketch, a.point.id, b.point.id, DATUM_AXIS_Y_ID);

    const outcome = createAddMaintainedConstraintCommand(sketch, {
      type: "symmetric",
      references: [
        { entityId: b.point.id, role: "position" },
        { entityId: a.point.id, role: "position" },
        { entityId: DATUM_AXIS_Y_ID, role: "entity" },
      ],
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toMatch(/equivalent symmetric/);
    }
  });

  it("rejects two points without a mirror line", () => {
    let sketch = createEmptySketch();
    const a = addPointToSketch(sketch, { x: 10, y: 0 });
    sketch = a.sketch;
    const b = addPointToSketch(sketch, { x: -10, y: 0 });
    const outcome = createAddMaintainedConstraintCommand(b.sketch, {
      type: "symmetric",
      references: [
        { entityId: a.point.id, role: "position" },
        { entityId: b.point.id, role: "position" },
        { entityId: a.point.id, role: "position" },
      ],
    });
    expect(outcome.ok).toBe(false);
  });

  it("removes 2 DOF for two free points about an axis", () => {
    let sketch = createEmptySketch();
    const a = addPointToSketch(sketch, { x: 12, y: 4 });
    sketch = a.sketch;
    const b = addPointToSketch(sketch, { x: -8, y: 7 });
    sketch = b.sketch;
    const before = analyzeDegreesOfFreedom(sketch).degreesOfFreedom;
    sketch = addSymmetric(sketch, a.point.id, b.point.id, DATUM_AXIS_Y_ID);
    const after = analyzeDegreesOfFreedom(sketch).degreesOfFreedom;
    expect(before - after).toBe(2);
    expect(solve(sketch).status).toBe("under-constrained");
  });
});
