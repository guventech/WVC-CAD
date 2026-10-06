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
import { TOLERANCE } from "../geometry/GeometryMath.ts";
import type { CircleGeometry } from "../model/Geometry.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { createEmptySketch, type Sketch } from "../model/Sketch.ts";
import { analyzeDegreesOfFreedom } from "./DegreesOfFreedom.ts";
import { listUnsatisfiedConstraints } from "./ConstraintMaintenance.ts";
import { concentricResidual } from "./Concentric.ts";
import { solve } from "../solver/Solver.ts";

function circleOf(sketch: Sketch, id: string): CircleGeometry {
  const entity = sketch.geometry.find((item) => item.id === id);
  if (entity?.type !== "circle") {
    throw new Error(`circle ${id} missing`);
  }
  return entity;
}

function addConcentric(sketch: Sketch, firstId: string, secondId: string): Sketch {
  const outcome = prepareAddConstraint(sketch, {
    type: "concentric",
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

describe("concentric constraint", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("moves two circle centers together", () => {
    let sketch = createEmptySketch();
    const a = addCircleToSketch(sketch, { x: 0, y: 0 }, 10)!;
    sketch = a.sketch;
    const b = addCircleToSketch(sketch, { x: 15, y: 8 }, 20)!;
    sketch = addConcentric(b.sketch, a.circle.id, b.circle.id);

    const ca = circleOf(sketch, a.circle.id);
    const cb = circleOf(sketch, b.circle.id);
    expect(ca.center.x).toBeCloseTo(cb.center.x, 6);
    expect(ca.center.y).toBeCloseTo(cb.center.y, 6);
    expect(ca.radius).toBeCloseTo(10, 6);
    expect(cb.radius).toBeCloseTo(20, 6);
    expect(concentricResidual(sketch, sketch.constraints[0]!)).toBeLessThanOrEqual(
      TOLERANCE.coincidence,
    );
    expect(listUnsatisfiedConstraints(sketch)).toEqual([]);
  });

  it("supports circle–arc concentric", () => {
    let sketch = createEmptySketch();
    const circle = addCircleToSketch(sketch, { x: 0, y: 0 }, 15)!;
    sketch = circle.sketch;
    const arc = addArcToSketch(sketch, { x: 12, y: 4 }, 25, 0, Math.PI)!;
    sketch = addConcentric(arc.sketch, circle.circle.id, arc.arc.id);

    const c = circleOf(sketch, circle.circle.id);
    const arcEntity = sketch.geometry.find((item) => item.id === arc.arc.id);
    expect(arcEntity?.type).toBe("arc");
    if (arcEntity?.type !== "arc") {
      return;
    }
    expect(c.center.x).toBeCloseTo(arcEntity.center.x, 6);
    expect(c.center.y).toBeCloseTo(arcEntity.center.y, 6);
  });

  it("keeps centers coincident while one center is dragged; undo/redo", () => {
    let sketch = createEmptySketch();
    const a = addCircleToSketch(sketch, { x: 0, y: 0 }, 10)!;
    sketch = a.sketch;
    const b = addCircleToSketch(sketch, { x: 0, y: 0 }, 25)!;
    sketch = addConcentric(b.sketch, a.circle.id, b.circle.id);

    const command = createMoveGeometryCommand(
      sketch,
      { kind: "circle-center", entityId: b.circle.id },
      { x: 0, y: 0 },
      { x: 30, y: 12 },
    )!;
    const moved = executeCommand(createCommandHistory(), sketch, command);
    const ca = circleOf(moved.sketch, a.circle.id);
    const cb = circleOf(moved.sketch, b.circle.id);
    expect(ca.center.x).toBeCloseTo(cb.center.x, 6);
    expect(ca.center.y).toBeCloseTo(cb.center.y, 6);
    expect(listUnsatisfiedConstraints(moved.sketch)).toEqual([]);

    const undone = undoCommand(moved.history, moved.sketch);
    expect(circleOf(undone.sketch, a.circle.id).center).toEqual({ x: 0, y: 0 });

    const redone = redoCommand(undone.history, undone.sketch);
    const ra = circleOf(redone.sketch, a.circle.id);
    const rb = circleOf(redone.sketch, b.circle.id);
    expect(ra.center.x).toBeCloseTo(rb.center.x, 6);
    expect(ra.center.y).toBeCloseTo(rb.center.y, 6);
  });

  it("radius drag preserves concentric centers", () => {
    let sketch = createEmptySketch();
    const a = addCircleToSketch(sketch, { x: 5, y: 5 }, 10)!;
    sketch = a.sketch;
    const b = addCircleToSketch(sketch, { x: 5, y: 5 }, 20)!;
    sketch = addConcentric(b.sketch, a.circle.id, b.circle.id);

    const moved = applyGeometryDragWithConstraints(
      sketch,
      { kind: "circle-radius", entityId: b.circle.id },
      { x: 5 + 35, y: 5 },
    );
    const ca = circleOf(moved, a.circle.id);
    const cb = circleOf(moved, b.circle.id);
    expect(ca.center.x).toBeCloseTo(cb.center.x, 6);
    expect(ca.center.y).toBeCloseTo(cb.center.y, 6);
    expect(cb.radius).toBeCloseTo(35, 5);
  });

  it("rejects a duplicate concentric", () => {
    let sketch = createEmptySketch();
    const a = addCircleToSketch(sketch, { x: 0, y: 0 }, 10)!;
    sketch = a.sketch;
    const b = addCircleToSketch(sketch, { x: 0, y: 0 }, 20)!;
    sketch = addConcentric(b.sketch, a.circle.id, b.circle.id);

    const outcome = createAddMaintainedConstraintCommand(sketch, {
      type: "concentric",
      references: [
        { entityId: b.circle.id, role: "entity" },
        { entityId: a.circle.id, role: "entity" },
      ],
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toMatch(/equivalent concentric/);
    }
  });

  it("rejects concentric on a line", () => {
    let sketch = createEmptySketch();
    const line = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 40, y: 0 })!;
    sketch = line.sketch;
    const circle = addCircleToSketch(sketch, { x: 0, y: 0 }, 10)!;
    const outcome = createAddMaintainedConstraintCommand(circle.sketch, {
      type: "concentric",
      references: [
        { entityId: line.line.id, role: "entity" },
        { entityId: circle.circle.id, role: "entity" },
      ],
    });
    expect(outcome.ok).toBe(false);
  });

  it("removes 2 DOF when two free circles become concentric", () => {
    let sketch = createEmptySketch();
    const a = addCircleToSketch(sketch, { x: 0, y: 0 }, 10)!;
    sketch = a.sketch;
    const b = addCircleToSketch(sketch, { x: 20, y: 0 }, 15)!;
    sketch = b.sketch;
    const before = analyzeDegreesOfFreedom(sketch).degreesOfFreedom;
    sketch = addConcentric(sketch, a.circle.id, b.circle.id);
    const after = analyzeDegreesOfFreedom(sketch).degreesOfFreedom;
    expect(before - after).toBe(2);
    expect(solve(sketch).status).toBe("under-constrained");
  });
});
