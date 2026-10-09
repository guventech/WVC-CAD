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
  type ConstraintCreateRequest,
} from "../commands/AddMaintainedConstraintCommand.ts";
import {
  addCircleToSketch,
  addLineToSketch,
  addPointToSketch,
} from "../commands/CreateGeometryCommand.ts";
import { createAddRectangleCommand } from "../commands/CreateRectangleCommand.ts";
import { createDeleteGeometryCommand } from "../commands/DeleteGeometryCommand.ts";
import { createEditDimensionCommand } from "../commands/EditDimensionCommand.ts";
import { applyGeometryDragWithConstraints } from "../commands/GeometryEdit.ts";
import { distance, TOLERANCE } from "../geometry/GeometryMath.ts";
import type { Geometry, LineGeometry } from "../model/Geometry.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import {
  parseRectangleFeature,
  readRectangleCorners,
} from "../model/RectangleFeature.ts";
import { createEmptySketch, type Sketch } from "../model/Sketch.ts";
import { listUnsatisfiedConstraints } from "./ConstraintMaintenance.ts";
import { measureDimension } from "./Dimensions.ts";

const DEG = Math.PI / 180;

function entity(sketch: Sketch, id: string): Geometry {
  const found = sketch.geometry.find((item) => item.id === id);
  if (found === undefined) {
    throw new Error(`entity ${id} missing`);
  }
  return found;
}

function line(sketch: Sketch, id: string): LineGeometry {
  const found = entity(sketch, id);
  if (found.type !== "line") {
    throw new Error("not a line");
  }
  return found;
}

function add(sketch: Sketch, request: ConstraintCreateRequest): Sketch {
  const outcome = prepareAddConstraint(sketch, request);
  if (!outcome.ok) {
    throw new Error(outcome.reason);
  }
  return outcome.sketch;
}

function editValue(sketch: Sketch, value: number): Sketch {
  const constraint = sketch.constraints[sketch.constraints.length - 1]!;
  const outcome = createEditDimensionCommand(sketch, constraint.id, { value });
  if (!outcome.ok) {
    throw new Error(outcome.reason);
  }
  return outcome.command.apply(sketch);
}

describe("dimensional constraints (Chunk 13)", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("creates a length dimension at the measured value without moving geometry", () => {
    const created = addLineToSketch(createEmptySketch(), { x: 0, y: 0 }, { x: 30, y: 40 })!;
    const sketch = add(created.sketch, {
      type: "length",
      references: [{ entityId: created.line.id, role: "entity" }],
    });
    expect(sketch.constraints[0]).toMatchObject({ type: "length", value: 50, driving: true });
    expect(sketch.geometry).toEqual(created.sketch.geometry);
  });

  it("editing a length drives the geometry; undo/redo restore values", () => {
    const created = addLineToSketch(createEmptySketch(), { x: 0, y: 0 }, { x: 50, y: 0 })!;
    const sketch = add(created.sketch, {
      type: "length",
      references: [{ entityId: created.line.id, role: "entity" }],
    });
    const id = sketch.constraints[0]!.id;
    const outcome = createEditDimensionCommand(sketch, id, { value: 75 });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }
    const edited = executeCommand(createCommandHistory(), sketch, outcome.command);
    const editedLine = line(edited.sketch, created.line.id);
    expect(distance(editedLine.start, editedLine.end)).toBeCloseTo(75, 5);
    expect(edited.sketch.constraints[0]!.value).toBe(75);

    const undone = undoCommand(edited.history, edited.sketch);
    expect(undone.sketch.constraints[0]!.value).toBe(50);
    expect(line(undone.sketch, created.line.id).end).toEqual({ x: 50, y: 0 });

    const redone = redoCommand(undone.history, undone.sketch);
    const redoneLine = line(redone.sketch, created.line.id);
    expect(distance(redoneLine.start, redoneLine.end)).toBeCloseTo(75, 5);
  });

  it("rejects invalid values (zero / negative / non-finite)", () => {
    const created = addLineToSketch(createEmptySketch(), { x: 0, y: 0 }, { x: 50, y: 0 })!;
    const sketch = add(created.sketch, {
      type: "length",
      references: [{ entityId: created.line.id, role: "entity" }],
    });
    const id = sketch.constraints[0]!.id;
    for (const value of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(createEditDimensionCommand(sketch, id, { value }).ok).toBe(false);
    }
  });

  it("drives horizontal and vertical distance between two points", () => {
    let sketch = createEmptySketch();
    const a = addPointToSketch(sketch, { x: 0, y: 0 });
    sketch = a.sketch;
    const b = addPointToSketch(sketch, { x: 20, y: 10 });
    sketch = b.sketch;
    const refs = [
      { entityId: a.point.id, role: "position" as const },
      { entityId: b.point.id, role: "position" as const },
    ];
    sketch = add(sketch, { type: "horizontal-distance", references: refs });
    sketch = editValue(sketch, 35);
    sketch = add(sketch, { type: "vertical-distance", references: refs });
    sketch = editValue(sketch, 4);
    expect(measureDimension(sketch, "horizontal-distance", refs)).toBeCloseTo(35, 6);
    expect(measureDimension(sketch, "vertical-distance", refs)).toBeCloseTo(4, 6);
    expect(listUnsatisfiedConstraints(sketch)).toEqual([]);
  });

  it("drives Euclidean distance between two diagonal points", () => {
    let sketch = createEmptySketch();
    const a = addPointToSketch(sketch, { x: 0, y: 0 });
    sketch = a.sketch;
    const b = addPointToSketch(sketch, { x: 30, y: 40 });
    sketch = b.sketch;
    const refs = [
      { entityId: a.point.id, role: "position" as const },
      { entityId: b.point.id, role: "position" as const },
    ];
    sketch = add(sketch, { type: "distance", references: refs });
    expect(measureDimension(sketch, "distance", refs)).toBeCloseTo(50, 6);
    sketch = editValue(sketch, 25);
    expect(measureDimension(sketch, "distance", refs)).toBeCloseTo(25, 5);
    expect(listUnsatisfiedConstraints(sketch)).toEqual([]);
  });

  it("drives circle radius and diameter; rejects zero radius", () => {
    const created = addCircleToSketch(createEmptySketch(), { x: 5, y: 5 }, 10)!;
    const ref = [{ entityId: created.circle.id, role: "entity" as const }];
    let sketch = add(created.sketch, { type: "radius", references: ref });
    sketch = editValue(sketch, 20);
    const circle = entity(sketch, created.circle.id);
    expect(circle.type === "circle" && circle.radius).toBeCloseTo(20, 5);
    expect(circle.type === "circle" && circle.center.x).toBeCloseTo(5, 5);
    expect(circle.type === "circle" && circle.center.y).toBeCloseTo(5, 5);
    expect(
      createEditDimensionCommand(sketch, sketch.constraints[0]!.id, { value: 0 }).ok,
    ).toBe(false);

    const other = addCircleToSketch(createEmptySketch(), { x: 0, y: 0 }, 10)!;
    let withDiameter = add(other.sketch, {
      type: "diameter",
      references: [{ entityId: other.circle.id, role: "entity" }],
    });
    withDiameter = editValue(withDiameter, 50);
    const sized = entity(withDiameter, other.circle.id);
    expect(sized.type === "circle" && sized.radius).toBeCloseTo(25, 5);
  });

  it("rejects radius + diameter on the same circle as redundant", () => {
    const created = addCircleToSketch(createEmptySketch(), { x: 0, y: 0 }, 10)!;
    const ref = [{ entityId: created.circle.id, role: "entity" as const }];
    const sketch = add(created.sketch, { type: "radius", references: ref });
    expect(prepareAddConstraint(sketch, { type: "diameter", references: ref }).ok).toBe(false);
  });

  it("drives the angle between two lines sharing a vertex", () => {
    let sketch = createEmptySketch();
    const a = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 40, y: 0 })!;
    sketch = a.sketch;
    const b = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 30, y: 30 })!;
    sketch = b.sketch;
    sketch = addCoincidentToSketch(
      sketch,
      { entityId: a.line.id, role: "start" },
      { entityId: b.line.id, role: "start" },
    )!;
    sketch = add(sketch, { type: "horizontal", references: [{ entityId: a.line.id, role: "entity" }] });
    const refs = [
      { entityId: a.line.id, role: "entity" as const },
      { entityId: b.line.id, role: "entity" as const },
    ];
    sketch = add(sketch, { type: "angle", references: refs });
    expect(sketch.constraints.at(-1)!.value).toBeCloseTo(45 * DEG, 9);

    sketch = editValue(sketch, 30 * DEG);
    expect(measureDimension(sketch, "angle", refs)).toBeCloseTo(30 * DEG, 6);
    const lineA = line(sketch, a.line.id);
    const lineB = line(sketch, b.line.id);
    expect(lineA.start.y).toBeCloseTo(lineA.end.y, 5);
    expect(distance(lineA.start, lineB.start)).toBeLessThan(TOLERANCE.coincidence);
    // Line B length is under-constrained without an explicit length dimension.
    expect(distance(lineB.start, lineB.end)).toBeGreaterThan(TOLERANCE.coincidence);
  });

  it("rejects an angle dimension between parallel lines", () => {
    let sketch = createEmptySketch();
    const a = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 40, y: 0 })!;
    sketch = a.sketch;
    const b = addLineToSketch(sketch, { x: 0, y: 10 }, { x: 40, y: 10 })!;
    const outcome = prepareAddConstraint(b.sketch, {
      type: "angle",
      references: [
        { entityId: a.line.id, role: "entity" },
        { entityId: b.line.id, role: "entity" },
      ],
    });
    expect(outcome.ok).toBe(false);
  });

  it("reference dimensions measure but never drive; switching to driving adopts measurement", () => {
    const created = addLineToSketch(createEmptySketch(), { x: 0, y: 0 }, { x: 50, y: 0 })!;
    let sketch = add(created.sketch, {
      type: "length",
      references: [{ entityId: created.line.id, role: "entity" }],
      driving: false,
    });
    const id = sketch.constraints[0]!.id;

    sketch = applyGeometryDragWithConstraints(
      sketch,
      { kind: "line-endpoint", entityId: created.line.id, which: "end" },
      { x: 80, y: 0 },
    );
    expect(line(sketch, created.line.id).end).toEqual({ x: 80, y: 0 });
    expect(
      measureDimension(sketch, "length", sketch.constraints[0]!.references),
    ).toBeCloseTo(80, 9);

    const toDriving = createEditDimensionCommand(sketch, id, { driving: true });
    expect(toDriving.ok).toBe(true);
    if (toDriving.ok) {
      const driven = toDriving.command.apply(sketch);
      expect(driven.constraints[0]).toMatchObject({ driving: true, value: 80 });
      expect(driven.geometry).toEqual(sketch.geometry);
    }
  });

  it("dragging an endpoint of a length-constrained line keeps the length", () => {
    const created = addLineToSketch(createEmptySketch(), { x: 0, y: 0 }, { x: 50, y: 0 })!;
    const sketch = add(created.sketch, {
      type: "length",
      references: [{ entityId: created.line.id, role: "entity" }],
    });
    const moved = applyGeometryDragWithConstraints(
      sketch,
      { kind: "line-endpoint", entityId: created.line.id, which: "end" },
      { x: 60, y: 30 },
    );
    const movedLine = line(moved, created.line.id);
    expect(movedLine.end).toEqual({ x: 60, y: 30 });
    expect(distance(movedLine.start, movedLine.end)).toBeCloseTo(50, 6);
  });

  it("rejects dragging the rim of a radius-dimensioned circle", () => {
    const created = addCircleToSketch(createEmptySketch(), { x: 0, y: 0 }, 10)!;
    const sketch = add(created.sketch, {
      type: "radius",
      references: [{ entityId: created.circle.id, role: "entity" }],
    });
    const moved = applyGeometryDragWithConstraints(
      sketch,
      { kind: "circle-radius", entityId: created.circle.id },
      { x: 25, y: 0 },
    );
    const circle = entity(moved, created.circle.id);
    expect(circle.type === "circle" && circle.radius).toBeCloseTo(10, 5);
    expect(moved).toBe(sketch);
  });

  it("rejects a conflicting dimension and leaves the sketch unchanged (Fixture E)", () => {
    const created = addLineToSketch(createEmptySketch(), { x: 0, y: 0 }, { x: 50, y: 0 })!;
    let sketch = add(created.sketch, {
      type: "horizontal",
      references: [{ entityId: created.line.id, role: "entity" }],
    });
    sketch = add(sketch, {
      type: "length",
      references: [{ entityId: created.line.id, role: "entity" }],
    });
    const outcome = createAddMaintainedConstraintCommand(sketch, {
      type: "horizontal-distance",
      references: [
        { entityId: created.line.id, role: "start" },
        { entityId: created.line.id, role: "end" },
      ],
      value: 80,
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toMatch(/No changes were made|conflict/i);
      expect(outcome.conflict?.conflictingConstraintIds.length).toBeGreaterThan(0);
    }
  });

  it("dimensions a rectangle 100 × 50 and it stays rectangular (Fixture C geometry)", () => {
    let sketch = createAddRectangleCommand({ x: 0, y: 0 }, { x: 40, y: 20 })!.apply(
      createEmptySketch(),
    );
    const feature = sketch.constraints
      .map(parseRectangleFeature)
      .find((item) => item !== null)!;
    sketch = add(sketch, {
      type: "length",
      references: [{ entityId: feature.edges.bottom, role: "entity" }],
    });
    sketch = editValue(sketch, 100);
    sketch = add(sketch, {
      type: "length",
      references: [{ entityId: feature.edges.left, role: "entity" }],
    });
    sketch = editValue(sketch, 50);

    const corners = readRectangleCorners(sketch.geometry, feature)!;
    expect(corners.br.x - corners.bl.x).toBeCloseTo(100, 5);
    expect(corners.tl.y - corners.bl.y).toBeCloseTo(50, 5);
    expect(corners.bl.y).toBeCloseTo(corners.br.y, 5);
    expect(corners.bl.x).toBeCloseTo(corners.tl.x, 5);
    expect(listUnsatisfiedConstraints(sketch)).toEqual([]);
  });

  it("deleting the circle removes its radius dimension", () => {
    const created = addCircleToSketch(createEmptySketch(), { x: 0, y: 0 }, 10)!;
    const sketch = add(created.sketch, {
      type: "radius",
      references: [{ entityId: created.circle.id, role: "entity" }],
    });
    const deleted = createDeleteGeometryCommand(sketch, [created.circle.id])!.apply(sketch);
    expect(deleted.constraints).toHaveLength(0);
  });
});
