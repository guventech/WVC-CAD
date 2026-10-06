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
  addArcToSketch,
  addCircleToSketch,
  addLineToSketch,
} from "../commands/CreateGeometryCommand.ts";
import {
  applyGeometryDragWithConstraints,
  createMoveGeometryCommand,
} from "../commands/GeometryEdit.ts";
import { distance, TOLERANCE } from "../geometry/GeometryMath.ts";
import { signedDistanceToLine } from "../geometry/FilletTopology.ts";
import type { CircleGeometry, LineGeometry } from "../model/Geometry.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { DATUM_AXIS_X_ID } from "../model/SketchFrame.ts";
import { createEmptySketch, type Sketch } from "../model/Sketch.ts";
import { listUnsatisfiedConstraints } from "./ConstraintMaintenance.ts";
import { tangentResidual } from "./Tangent.ts";
import { solve } from "../solver/Solver.ts";

function lineOf(sketch: Sketch, id: string): LineGeometry {
  const entity = sketch.geometry.find((item) => item.id === id);
  if (entity?.type !== "line") {
    throw new Error(`line ${id} missing`);
  }
  return entity;
}

function circleOf(sketch: Sketch, id: string): CircleGeometry {
  const entity = sketch.geometry.find((item) => item.id === id);
  if (entity?.type !== "circle") {
    throw new Error(`circle ${id} missing`);
  }
  return entity;
}

function addTangent(
  sketch: Sketch,
  firstId: string,
  secondId: string,
): Sketch {
  const outcome = prepareAddConstraint(sketch, {
    type: "tangent",
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

describe("tangent constraint", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("makes a circle tangent to a line", () => {
    let sketch = createEmptySketch();
    const line = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 80, y: 0 })!;
    sketch = line.sketch;
    // Center above the line; radius too large → solve should lift/move to contact.
    const circle = addCircleToSketch(sketch, { x: 40, y: 5 }, 20)!;
    sketch = addTangent(circle.sketch, line.line.id, circle.circle.id);

    const l = lineOf(sketch, line.line.id);
    const c = circleOf(sketch, circle.circle.id);
    const signed = signedDistanceToLine(c.center, l);
    expect(signed).not.toBeNull();
    expect(Math.abs(Math.abs(signed!) - c.radius)).toBeLessThan(
      TOLERANCE.coincidence,
    );
    expect(listUnsatisfiedConstraints(sketch)).toEqual([]);
    expect(tangentResidual(sketch, sketch.constraints[0]!)).toBeLessThanOrEqual(
      TOLERANCE.coincidence,
    );
  });

  it("makes two circles externally tangent", () => {
    let sketch = createEmptySketch();
    const a = addCircleToSketch(sketch, { x: 0, y: 0 }, 10)!;
    sketch = a.sketch;
    const b = addCircleToSketch(sketch, { x: 25, y: 0 }, 10)!;
    sketch = addTangent(b.sketch, a.circle.id, b.circle.id);

    const ca = circleOf(sketch, a.circle.id);
    const cb = circleOf(sketch, b.circle.id);
    expect(distance(ca.center, cb.center)).toBeCloseTo(ca.radius + cb.radius, 5);
    expect(solve(sketch).status).toBe("under-constrained");
  });

  it("makes two circles internally tangent when one is inside the other", () => {
    let sketch = createEmptySketch();
    const a = addCircleToSketch(sketch, { x: 0, y: 0 }, 30)!;
    sketch = a.sketch;
    const b = addCircleToSketch(sketch, { x: 5, y: 0 }, 10)!;
    sketch = addTangent(b.sketch, a.circle.id, b.circle.id);

    const ca = circleOf(sketch, a.circle.id);
    const cb = circleOf(sketch, b.circle.id);
    expect(distance(ca.center, cb.center)).toBeCloseTo(
      Math.abs(ca.radius - cb.radius),
      5,
    );
  });

  it("supports line–arc tangent", () => {
    let sketch = createEmptySketch();
    const line = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 60, y: 0 })!;
    sketch = line.sketch;
    const arc = addArcToSketch(sketch, { x: 30, y: 8 }, 20, 0, Math.PI / 2)!;
    sketch = addTangent(arc.sketch, line.line.id, arc.arc.id);
    expect(listUnsatisfiedConstraints(sketch)).toEqual([]);
  });

  it("tangent to world X-axis keeps center at ±radius", () => {
    const created = addCircleToSketch(createEmptySketch(), { x: 20, y: 8 }, 10)!;
    const sketch = addTangent(created.sketch, created.circle.id, DATUM_AXIS_X_ID);
    const c = circleOf(sketch, created.circle.id);
    expect(Math.abs(Math.abs(c.center.y) - c.radius)).toBeLessThan(
      TOLERANCE.coincidence,
    );
  });

  it("keeps tangent while the circle center is dragged; undo/redo", () => {
    let sketch = createEmptySketch();
    const line = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 100, y: 0 })!;
    sketch = line.sketch;
    const circle = addCircleToSketch(sketch, { x: 40, y: 15 }, 15)!;
    sketch = addTangent(circle.sketch, line.line.id, circle.circle.id);

    const command = createMoveGeometryCommand(
      sketch,
      { kind: "circle-center", entityId: circle.circle.id },
      { x: 40, y: 15 },
      { x: 70, y: 40 },
    )!;
    const moved = executeCommand(createCommandHistory(), sketch, command);
    const l = lineOf(moved.sketch, line.line.id);
    const c = circleOf(moved.sketch, circle.circle.id);
    const signed = signedDistanceToLine(c.center, l)!;
    expect(Math.abs(Math.abs(signed) - c.radius)).toBeLessThan(1e-4);
    expect(listUnsatisfiedConstraints(moved.sketch)).toEqual([]);

    const undone = undoCommand(moved.history, moved.sketch);
    expect(circleOf(undone.sketch, circle.circle.id).center.x).toBeCloseTo(40, 5);

    const redone = redoCommand(undone.history, undone.sketch);
    expect(listUnsatisfiedConstraints(redone.sketch)).toEqual([]);
  });

  it("line-body drag keeps circle tangent", () => {
    let sketch = createEmptySketch();
    const line = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 80, y: 0 })!;
    sketch = line.sketch;
    const circle = addCircleToSketch(sketch, { x: 40, y: 20 }, 20)!;
    sketch = addTangent(circle.sketch, line.line.id, circle.circle.id);

    const moved = applyGeometryDragWithConstraints(
      sketch,
      {
        kind: "line-body",
        entityId: line.line.id,
        grabOffset: { x: 40, y: 0 },
        span: { x: 80, y: 0 },
      },
      { x: 40, y: 12 },
    );
    const l = lineOf(moved, line.line.id);
    const c = circleOf(moved, circle.circle.id);
    const signed = signedDistanceToLine(c.center, l)!;
    expect(Math.abs(Math.abs(signed) - c.radius)).toBeLessThan(1e-4);
  });

  it("rejects a duplicate tangent on the same pair", () => {
    let sketch = createEmptySketch();
    const line = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 80, y: 0 })!;
    sketch = line.sketch;
    const circle = addCircleToSketch(sketch, { x: 40, y: 20 }, 20)!;
    sketch = addTangent(circle.sketch, line.line.id, circle.circle.id);

    const outcome = createAddMaintainedConstraintCommand(sketch, {
      type: "tangent",
      references: [
        { entityId: circle.circle.id, role: "entity" },
        { entityId: line.line.id, role: "entity" },
      ],
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toMatch(/equivalent tangent/);
    }
  });

  it("rejects two lines as a tangent pair", () => {
    let sketch = createEmptySketch();
    const a = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 40, y: 0 })!;
    sketch = a.sketch;
    const b = addLineToSketch(sketch, { x: 0, y: 10 }, { x: 40, y: 10 })!;
    const outcome = createAddMaintainedConstraintCommand(b.sketch, {
      type: "tangent",
      references: [
        { entityId: a.line.id, role: "entity" },
        { entityId: b.line.id, role: "entity" },
      ],
    });
    expect(outcome.ok).toBe(false);
  });
});
