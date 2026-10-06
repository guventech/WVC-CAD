import { beforeEach, describe, expect, it } from "vitest";
import {
  createAddMaintainedConstraintCommand,
  prepareAddConstraint,
} from "../commands/AddMaintainedConstraintCommand.ts";
import {
  addArcToSketch,
  addCircleToSketch,
  addLineToSketch,
  addPointToSketch,
} from "../commands/CreateGeometryCommand.ts";
import { TOLERANCE } from "../geometry/GeometryMath.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { createEmptySketch, type Sketch } from "../model/Sketch.ts";
import { analyzeDegreesOfFreedom } from "./DegreesOfFreedom.ts";
import { listUnsatisfiedConstraints } from "./ConstraintMaintenance.ts";
import { pointOnObjectResidual } from "./PointOnObject.ts";
import { solve } from "../solver/Solver.ts";

function fixEntity(sketch: Sketch, entityId: string): Sketch {
  const outcome = prepareAddConstraint(sketch, {
    type: "fix",
    references: [{ entityId, role: "entity" }],
  });
  if (!outcome.ok) {
    throw new Error(outcome.reason);
  }
  return outcome.sketch;
}

function addPointOnObject(
  sketch: Sketch,
  pointId: string,
  objectId: string,
): Sketch {
  const outcome = prepareAddConstraint(sketch, {
    type: "point-on-object",
    references: [
      { entityId: pointId, role: "position" },
      { entityId: objectId, role: "entity" },
    ],
  });
  if (!outcome.ok) {
    throw new Error(outcome.reason);
  }
  return outcome.sketch;
}

describe("point-on-object constraint", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("projects a free point onto a line segment", () => {
    let sketch = createEmptySketch();
    const line = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 40, y: 0 })!;
    sketch = fixEntity(line.sketch, line.line.id);
    const point = addPointToSketch(sketch, { x: 20, y: 15 });
    sketch = addPointOnObject(point.sketch, point.point.id, line.line.id);

    const p = sketch.geometry.find((item) => item.id === point.point.id);
    expect(p?.type).toBe("point");
    if (p?.type !== "point") {
      return;
    }
    expect(p.position.x).toBeCloseTo(20, 5);
    expect(p.position.y).toBeCloseTo(0, 5);
    const onObject = sketch.constraints.find((c) => c.type === "point-on-object");
    expect(onObject).toBeDefined();
    expect(
      pointOnObjectResidual(sketch, onObject!),
    ).toBeLessThanOrEqual(TOLERANCE.coincidence);
    expect(listUnsatisfiedConstraints(sketch)).toEqual([]);
  });

  it("places a point on a circle circumference", () => {
    let sketch = createEmptySketch();
    const circle = addCircleToSketch(sketch, { x: 0, y: 0 }, 20)!;
    sketch = fixEntity(circle.sketch, circle.circle.id);
    const point = addPointToSketch(sketch, { x: 25, y: 10 });
    sketch = addPointOnObject(point.sketch, point.point.id, circle.circle.id);

    const p = sketch.geometry.find((item) => item.id === point.point.id);
    expect(p?.type).toBe("point");
    if (p?.type !== "point") {
      return;
    }
    const dist = Math.hypot(p.position.x, p.position.y);
    expect(dist).toBeCloseTo(20, 5);
    expect(listUnsatisfiedConstraints(sketch)).toEqual([]);
  });

  it("places a point on an arc", () => {
    let sketch = createEmptySketch();
    const arc = addArcToSketch(sketch, { x: 0, y: 0 }, 30, 0, Math.PI / 2)!;
    sketch = fixEntity(arc.sketch, arc.arc.id);
    const point = addPointToSketch(sketch, { x: 5, y: 35 });
    sketch = addPointOnObject(point.sketch, point.point.id, arc.arc.id);

    const p = sketch.geometry.find((item) => item.id === point.point.id);
    expect(p?.type).toBe("point");
    if (p?.type !== "point") {
      return;
    }
    expect(Math.hypot(p.position.x, p.position.y)).toBeCloseTo(30, 4);
    expect(listUnsatisfiedConstraints(sketch)).toEqual([]);
  });

  it("rejects a duplicate point-on-object", () => {
    let sketch = createEmptySketch();
    const line = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 30, y: 0 })!;
    sketch = line.sketch;
    const point = addPointToSketch(sketch, { x: 10, y: 5 });
    sketch = addPointOnObject(point.sketch, point.point.id, line.line.id);

    const outcome = createAddMaintainedConstraintCommand(sketch, {
      type: "point-on-object",
      references: [
        { entityId: line.line.id, role: "entity" },
        { entityId: point.point.id, role: "position" },
      ],
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toMatch(/equivalent point-on-object/);
    }
  });

  it("removes 1 DOF for a point on a circle", () => {
    let sketch = createEmptySketch();
    const circle = addCircleToSketch(sketch, { x: 0, y: 0 }, 15)!;
    sketch = fixEntity(circle.sketch, circle.circle.id);
    const point = addPointToSketch(sketch, { x: 20, y: 5 });
    sketch = point.sketch;
    const before = analyzeDegreesOfFreedom(sketch).degreesOfFreedom;
    sketch = addPointOnObject(sketch, point.point.id, circle.circle.id);
    const after = analyzeDegreesOfFreedom(sketch).degreesOfFreedom;
    expect(before - after).toBe(1);
    expect(solve(sketch).status).toBe("under-constrained");
  });
});
