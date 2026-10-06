import { beforeEach, describe, expect, it } from "vitest";
import {
  createAddMaintainedConstraintCommand,
  prepareAddConstraint,
} from "../commands/AddMaintainedConstraintCommand.ts";
import {
  createAddCircleCommand,
  createAddLineCommand,
  createAddPointCommand,
} from "../commands/CreateGeometryCommand.ts";
import { createAddRectangleCommand } from "../commands/CreateRectangleCommand.ts";
import { applyGeometryDragWithConstraints } from "../commands/GeometryEdit.ts";
import { listUnsatisfiedConstraints } from "./ConstraintMaintenance.ts";
import { analyzeDegreesOfFreedom } from "./DegreesOfFreedom.ts";
import { fixResidual } from "./Fix.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { parseRectangleFeature } from "../model/RectangleFeature.ts";
import { DATUM_ORIGIN_ID } from "../model/SketchFrame.ts";
import { createEmptySketch } from "../model/Sketch.ts";
import {
  parseSketchJson,
  serializeSketchToJson,
} from "../serialization/SketchSerializer.ts";
import { solve } from "../solver/Solver.ts";

describe("Fix constraint", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("locks a free point and removes 2 DOF", () => {
    const created = createAddPointCommand({ x: 12, y: 34 }).apply(
      createEmptySketch(),
    );
    expect(analyzeDegreesOfFreedom(created).degreesOfFreedom).toBe(2);

    const added = createAddMaintainedConstraintCommand(created, {
      type: "fix",
      references: [{ entityId: created.geometry[0]!.id, role: "position" }],
    });
    expect(added.ok).toBe(true);
    if (!added.ok) {
      return;
    }
    const sketch = added.command.apply(created);
    expect(listUnsatisfiedConstraints(sketch)).toEqual([]);
    expect(analyzeDegreesOfFreedom(sketch).degreesOfFreedom).toBe(0);
    expect(solve(sketch).status).toBe("solved");
    expect(fixResidual(sketch, added.constraint)).toBeLessThan(1e-9);
  });

  it("locks a whole line (both endpoints) via the same Fix command", () => {
    const created = createAddLineCommand({ x: 0, y: 0 }, { x: 40, y: 10 })!.apply(
      createEmptySketch(),
    );
    const lineId = created.geometry.find((g) => g.type === "line")!.id;
    expect(analyzeDegreesOfFreedom(created).degreesOfFreedom).toBe(4);

    const added = createAddMaintainedConstraintCommand(created, {
      type: "fix",
      references: [{ entityId: lineId, role: "entity" }],
    });
    expect(added.ok).toBe(true);
    if (!added.ok) {
      return;
    }
    const sketch = added.command.apply(created);
    expect(added.constraint.locked?.endX).toBeCloseTo(40, 6);
    expect(analyzeDegreesOfFreedom(sketch).degreesOfFreedom).toBe(0);
    expect(solve(sketch).status).toBe("solved");
  });

  it("locks a circle (center + radius) via the same Fix command", () => {
    const created = createAddCircleCommand({ x: 5, y: 6 }, { x: 17, y: 6 })!.apply(
      createEmptySketch(),
    );
    const circleId = created.geometry.find((g) => g.type === "circle")!.id;
    expect(analyzeDegreesOfFreedom(created).degreesOfFreedom).toBe(3);

    const added = createAddMaintainedConstraintCommand(created, {
      type: "fix",
      references: [{ entityId: circleId, role: "entity" }],
    });
    expect(added.ok).toBe(true);
    if (!added.ok) {
      return;
    }
    const sketch = added.command.apply(created);
    expect(added.constraint.locked?.radius).toBeCloseTo(12, 6);
    expect(analyzeDegreesOfFreedom(sketch).degreesOfFreedom).toBe(0);
    expect(solve(sketch).status).toBe("solved");

    const moved = applyGeometryDragWithConstraints(
      sketch,
      { kind: "circle-center", entityId: circleId },
      { x: 50, y: 50 },
    );
    expect(moved).toBe(sketch);
  });

  it("rejects dragging a fixed point", () => {
    let sketch = createAddPointCommand({ x: 10, y: 20 }).apply(createEmptySketch());
    const pointId = sketch.geometry[0]!.id;
    const added = createAddMaintainedConstraintCommand(sketch, {
      type: "fix",
      references: [{ entityId: pointId, role: "position" }],
    });
    expect(added.ok).toBe(true);
    if (!added.ok) {
      return;
    }
    sketch = added.command.apply(sketch);

    const next = applyGeometryDragWithConstraints(
      sketch,
      { kind: "point", entityId: pointId },
      { x: 40, y: 50 },
    );
    expect(next).toBe(sketch);
    const point = next.geometry.find((g) => g.id === pointId);
    expect(point?.type).toBe("point");
    if (point?.type === "point") {
      expect(point.position.x).toBeCloseTo(10, 6);
      expect(point.position.y).toBeCloseTo(20, 6);
    }
  });

  it("anchors one rectangle corner and leaves size DOF", () => {
    let sketch = createAddRectangleCommand(
      { x: 0, y: 0 },
      { x: 100, y: 50 },
    )!.apply(createEmptySketch());
    expect(analyzeDegreesOfFreedom(sketch).degreesOfFreedom).toBe(4);

    const rect = parseRectangleFeature(
      sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;
    const added = createAddMaintainedConstraintCommand(sketch, {
      type: "fix",
      references: [{ entityId: rect.corners.bl!, role: "position" }],
    });
    expect(added.ok).toBe(true);
    if (!added.ok) {
      return;
    }
    sketch = added.command.apply(sketch);
    expect(analyzeDegreesOfFreedom(sketch).degreesOfFreedom).toBe(2);
    expect(solve(sketch).status).toBe("under-constrained");
  });

  it("rejects a duplicate Fix on the same handle", () => {
    const created = createAddPointCommand({ x: 5, y: 6 }).apply(createEmptySketch());
    const first = prepareAddConstraint(created, {
      type: "fix",
      references: [{ entityId: created.geometry[0]!.id, role: "position" }],
    });
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    const second = prepareAddConstraint(first.sketch, {
      type: "fix",
      references: [{ entityId: created.geometry[0]!.id, role: "position" }],
    });
    expect(second.ok).toBe(false);
    if (second.ok) {
      return;
    }
    expect(second.reason).toMatch(/already exists/i);
  });

  it("rejects Fix on the world origin", () => {
    const outcome = prepareAddConstraint(createEmptySketch(), {
      type: "fix",
      references: [{ entityId: DATUM_ORIGIN_ID, role: "position" }],
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) {
      return;
    }
    expect(outcome.reason).toMatch(/datum|point|line|circle/i);
  });

  it("round-trips locked line through save/load", () => {
    let sketch = createAddLineCommand({ x: 1, y: 2 }, { x: 3, y: 4 })!.apply(
      createEmptySketch(),
    );
    const lineId = sketch.geometry.find((g) => g.type === "line")!.id;
    const added = createAddMaintainedConstraintCommand(sketch, {
      type: "fix",
      references: [{ entityId: lineId, role: "entity" }],
    });
    expect(added.ok).toBe(true);
    if (!added.ok) {
      return;
    }
    sketch = added.command.apply(sketch);
    const parsed = parseSketchJson(serializeSketchToJson(sketch));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    const fix = parsed.sketch.constraints.find((c) => c.type === "fix");
    expect(fix?.locked).toEqual({ x: 1, y: 2, endX: 3, endY: 4 });
    expect(analyzeDegreesOfFreedom(parsed.sketch).degreesOfFreedom).toBe(0);
  });
});
