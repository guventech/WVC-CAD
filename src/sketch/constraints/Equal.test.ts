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
import type { CircleGeometry, LineGeometry } from "../model/Geometry.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { createEmptySketch, type Sketch } from "../model/Sketch.ts";
import { analyzeDegreesOfFreedom } from "./DegreesOfFreedom.ts";
import { listUnsatisfiedConstraints } from "./ConstraintMaintenance.ts";
import { equalResidual } from "./Equal.ts";
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

function addEqual(sketch: Sketch, firstId: string, secondId: string): Sketch {
  const outcome = prepareAddConstraint(sketch, {
    type: "equal",
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

describe("equal constraint", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("makes two lines the same length", () => {
    let sketch = createEmptySketch();
    const a = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 40, y: 0 })!;
    sketch = a.sketch;
    const b = addLineToSketch(sketch, { x: 0, y: 10 }, { x: 10, y: 10 })!;
    sketch = addEqual(b.sketch, a.line.id, b.line.id);

    const la = lineOf(sketch, a.line.id);
    const lb = lineOf(sketch, b.line.id);
    const lenA = Math.hypot(la.end.x - la.start.x, la.end.y - la.start.y);
    const lenB = Math.hypot(lb.end.x - lb.start.x, lb.end.y - lb.start.y);
    expect(lenA).toBeCloseTo(lenB, 6);
    expect(equalResidual(sketch, sketch.constraints[0]!)).toBeLessThanOrEqual(
      TOLERANCE.coincidence,
    );
    expect(listUnsatisfiedConstraints(sketch)).toEqual([]);
  });

  it("makes two circles the same radius", () => {
    let sketch = createEmptySketch();
    const a = addCircleToSketch(sketch, { x: 0, y: 0 }, 10)!;
    sketch = a.sketch;
    const b = addCircleToSketch(sketch, { x: 40, y: 0 }, 25)!;
    sketch = addEqual(b.sketch, a.circle.id, b.circle.id);

    expect(circleOf(sketch, a.circle.id).radius).toBeCloseTo(
      circleOf(sketch, b.circle.id).radius,
      6,
    );
  });

  it("supports circle–arc equal radius", () => {
    let sketch = createEmptySketch();
    const circle = addCircleToSketch(sketch, { x: 0, y: 0 }, 12)!;
    sketch = circle.sketch;
    const arc = addArcToSketch(sketch, { x: 40, y: 0 }, 30, 0, Math.PI)!;
    sketch = addEqual(arc.sketch, circle.circle.id, arc.arc.id);

    const c = circleOf(sketch, circle.circle.id);
    const arcEntity = sketch.geometry.find((item) => item.id === arc.arc.id);
    expect(arcEntity?.type).toBe("arc");
    if (arcEntity?.type !== "arc") {
      return;
    }
    expect(c.radius).toBeCloseTo(arcEntity.radius, 6);
  });

  it("keeps equal lengths while one endpoint is dragged; undo/redo", () => {
    let sketch = createEmptySketch();
    const a = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 30, y: 0 })!;
    sketch = a.sketch;
    const b = addLineToSketch(sketch, { x: 0, y: 20 }, { x: 30, y: 20 })!;
    sketch = addEqual(b.sketch, a.line.id, b.line.id);

    const command = createMoveGeometryCommand(
      sketch,
      { kind: "line-endpoint", entityId: b.line.id, which: "end" },
      { x: 30, y: 20 },
      { x: 50, y: 20 },
    )!;
    const moved = executeCommand(createCommandHistory(), sketch, command);
    const la = lineOf(moved.sketch, a.line.id);
    const lb = lineOf(moved.sketch, b.line.id);
    const lenA = Math.hypot(la.end.x - la.start.x, la.end.y - la.start.y);
    const lenB = Math.hypot(lb.end.x - lb.start.x, lb.end.y - lb.start.y);
    expect(lenA).toBeCloseTo(lenB, 5);
    expect(listUnsatisfiedConstraints(moved.sketch)).toEqual([]);

    const undone = undoCommand(moved.history, moved.sketch);
    expect(lineOf(undone.sketch, b.line.id).end).toEqual({ x: 30, y: 20 });

    const redone = redoCommand(undone.history, undone.sketch);
    const ra = lineOf(redone.sketch, a.line.id);
    const rb = lineOf(redone.sketch, b.line.id);
    const rLenA = Math.hypot(ra.end.x - ra.start.x, ra.end.y - ra.start.y);
    const rLenB = Math.hypot(rb.end.x - rb.start.x, rb.end.y - rb.start.y);
    expect(rLenA).toBeCloseTo(rLenB, 5);
  });

  it("radius drag preserves equal radii", () => {
    let sketch = createEmptySketch();
    const a = addCircleToSketch(sketch, { x: 0, y: 0 }, 10)!;
    sketch = a.sketch;
    const b = addCircleToSketch(sketch, { x: 50, y: 0 }, 10)!;
    sketch = addEqual(b.sketch, a.circle.id, b.circle.id);

    const moved = applyGeometryDragWithConstraints(
      sketch,
      { kind: "circle-radius", entityId: b.circle.id },
      { x: 50 + 28, y: 0 },
    );
    const ra = circleOf(moved, a.circle.id).radius;
    const rb = circleOf(moved, b.circle.id).radius;
    expect(ra).toBeCloseTo(rb, 5);
    // Radius drag does not pin radius as an anchor; both may settle together.
    expect(rb).toBeGreaterThan(10);
  });

  it("rejects a duplicate equal", () => {
    let sketch = createEmptySketch();
    const a = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 20, y: 0 })!;
    sketch = a.sketch;
    const b = addLineToSketch(sketch, { x: 0, y: 5 }, { x: 20, y: 5 })!;
    sketch = addEqual(b.sketch, a.line.id, b.line.id);

    const outcome = createAddMaintainedConstraintCommand(sketch, {
      type: "equal",
      references: [
        { entityId: b.line.id, role: "entity" },
        { entityId: a.line.id, role: "entity" },
      ],
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toMatch(/equivalent equal/);
    }
  });

  it("rejects mixed line and circle", () => {
    let sketch = createEmptySketch();
    const line = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 40, y: 0 })!;
    sketch = line.sketch;
    const circle = addCircleToSketch(sketch, { x: 0, y: 0 }, 10)!;
    const outcome = createAddMaintainedConstraintCommand(circle.sketch, {
      type: "equal",
      references: [
        { entityId: line.line.id, role: "entity" },
        { entityId: circle.circle.id, role: "entity" },
      ],
    });
    expect(outcome.ok).toBe(false);
  });

  it("removes 1 DOF when two free lines become equal length", () => {
    let sketch = createEmptySketch();
    const a = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 40, y: 0 })!;
    sketch = a.sketch;
    const b = addLineToSketch(sketch, { x: 0, y: 10 }, { x: 25, y: 10 })!;
    sketch = b.sketch;
    const before = analyzeDegreesOfFreedom(sketch).degreesOfFreedom;
    sketch = addEqual(sketch, a.line.id, b.line.id);
    const after = analyzeDegreesOfFreedom(sketch).degreesOfFreedom;
    expect(before - after).toBe(1);
    expect(solve(sketch).status).toBe("under-constrained");
  });
});
