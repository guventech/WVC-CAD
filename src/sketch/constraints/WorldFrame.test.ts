import { beforeEach, describe, expect, it } from "vitest";
import { addCoincidentToSketch } from "../commands/AddCoincidentCommand.ts";
import {
  createDeleteGeometryCommand,
  selectionIsOnlyDatums,
  WORLD_FRAME_DELETE_BLOCKED_REASON,
} from "../commands/DeleteGeometryCommand.ts";
import {
  addCircleToSketch,
  addLineToSketch,
  addPointToSketch,
} from "../commands/CreateGeometryCommand.ts";
import { createAddRectangleCommand } from "../commands/CreateRectangleCommand.ts";
import { applyGeometryDragWithConstraints } from "../commands/GeometryEdit.ts";
import { createEditDimensionCommand } from "../commands/EditDimensionCommand.ts";
import { prepareAddConstraint } from "../commands/AddMaintainedConstraintCommand.ts";
import { analyzeDegreesOfFreedom } from "./DegreesOfFreedom.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { parseRectangleFeature } from "../model/RectangleFeature.ts";
import {
  DATUM_AXIS_X_ID,
  DATUM_AXIS_Y_ID,
  DATUM_ORIGIN_ID,
} from "../model/SketchFrame.ts";
import { createEmptySketch } from "../model/Sketch.ts";
import { hitTestSketch } from "../selection/HitTesting.ts";
import { findSnap } from "../selection/SnapEngine.ts";
import { listUnsatisfiedConstraints } from "../solver/Residuals.ts";
import { solve } from "../solver/Solver.ts";
import { createCamera } from "../viewport/Camera.ts";
import { TOLERANCE } from "../geometry/GeometryMath.ts";

describe("World Datum Frame (Pre–Chunk 16)", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("does not change DOF until geometry is constrained to the frame", () => {
    const created = addLineToSketch(createEmptySketch(), { x: 10, y: 5 }, { x: 40, y: 15 })!;
    expect(analyzeDegreesOfFreedom(created.sketch).degreesOfFreedom).toBe(4);
  });

  it("blocks deleting world datums", () => {
    const sketch = createEmptySketch();
    expect(selectionIsOnlyDatums(sketch, [DATUM_ORIGIN_ID])).toBe(true);
    expect(createDeleteGeometryCommand(sketch, [DATUM_ORIGIN_ID])).toBeNull();
    expect(createDeleteGeometryCommand(sketch, [DATUM_AXIS_X_ID, DATUM_AXIS_Y_ID])).toBeNull();
    expect(WORLD_FRAME_DELETE_BLOCKED_REASON).toMatch(/cannot be deleted/i);
  });

  it("coincides a point to the origin and removes 2 DOF", () => {
    const created = addPointToSketch(createEmptySketch(), { x: 12, y: 8 });
    const sketch = addCoincidentToSketch(created.sketch, {
      entityId: created.point.id,
      role: "position",
    }, {
      entityId: DATUM_ORIGIN_ID,
      role: "position",
    });
    expect(sketch).not.toBeNull();
    if (sketch === null) {
      return;
    }
    const point = sketch.geometry.find((entity) => entity.id === created.point.id);
    expect(point?.type === "point" && point.position).toEqual({ x: 0, y: 0 });
    expect(listUnsatisfiedConstraints(sketch)).toEqual([]);
    expect(analyzeDegreesOfFreedom(sketch).degreesOfFreedom).toBe(0);
    expect(solve(sketch).status).toBe("solved");
  });

  it("locks Y when a point is coincident with the X axis; drag along X works", () => {
    const created = addPointToSketch(createEmptySketch(), { x: 15, y: 10 });
    const constrained = addCoincidentToSketch(
      created.sketch,
      { entityId: created.point.id, role: "position" },
      { entityId: DATUM_AXIS_X_ID, role: "entity" },
    );
    expect(constrained).not.toBeNull();
    if (constrained === null) {
      return;
    }
    const onAxis = constrained.geometry.find((entity) => entity.id === created.point.id);
    expect(onAxis?.type === "point" && onAxis.position.y).toBeCloseTo(0, 6);

    const dragged = applyGeometryDragWithConstraints(
      constrained,
      { kind: "point", entityId: created.point.id },
      { x: 40, y: 25 },
    );
    const after = dragged.geometry.find((entity) => entity.id === created.point.id);
    expect(after?.type).toBe("point");
    if (after?.type === "point") {
      expect(after.position.x).toBeCloseTo(40, 5);
      expect(after.position.y).toBeCloseTo(0, 5);
    }
    expect(listUnsatisfiedConstraints(dragged)).toEqual([]);
  });

  it("Fixture C — rectangle 100×50 coincident to origin is fully constrained", () => {
    let sketch = createAddRectangleCommand({ x: 0, y: 0 }, { x: 40, y: 20 })!.apply(
      createEmptySketch(),
    );
    const feature = sketch.constraints
      .map(parseRectangleFeature)
      .find((item) => item !== null)!;

    sketch = addCoincidentToSketch(
      sketch,
      { entityId: feature.corners.bl!, role: "position" },
      { entityId: DATUM_ORIGIN_ID, role: "position" },
    )!;

    const widthAdd = prepareAddConstraint(sketch, {
      type: "length",
      references: [{ entityId: feature.edges.bottom, role: "entity" }],
    });
    expect(widthAdd.ok).toBe(true);
    if (!widthAdd.ok) {
      return;
    }
    sketch = widthAdd.sketch;
    const widthId = sketch.constraints.find((c) => c.type === "length")!.id;
    const widthEdit = createEditDimensionCommand(sketch, widthId, { value: 100 });
    expect(widthEdit.ok).toBe(true);
    if (!widthEdit.ok) {
      return;
    }
    sketch = widthEdit.command.apply(sketch);

    const heightAdd = prepareAddConstraint(sketch, {
      type: "length",
      references: [{ entityId: feature.edges.left, role: "entity" }],
    });
    expect(heightAdd.ok).toBe(true);
    if (!heightAdd.ok) {
      return;
    }
    sketch = heightAdd.sketch;
    const heightId = sketch.constraints.filter((c) => c.type === "length").at(-1)!.id;
    const heightEdit = createEditDimensionCommand(sketch, heightId, { value: 50 });
    expect(heightEdit.ok).toBe(true);
    if (!heightEdit.ok) {
      return;
    }
    sketch = heightEdit.command.apply(sketch);

    const result = solve(sketch);
    expect(result.degreesOfFreedom).toBe(0);
    expect(result.status).toBe("solved");
  });

  it("Fixture D — circle R=20 center coincident to origin is fully constrained", () => {
    const created = addCircleToSketch(createEmptySketch(), { x: 5, y: 5 }, 10)!;
    let sketch = addCoincidentToSketch(
      created.sketch,
      { entityId: created.circle.id, role: "center" },
      { entityId: DATUM_ORIGIN_ID, role: "position" },
    )!;
    const radiusAdd = prepareAddConstraint(sketch, {
      type: "radius",
      references: [{ entityId: created.circle.id, role: "entity" }],
    });
    expect(radiusAdd.ok).toBe(true);
    if (!radiusAdd.ok) {
      return;
    }
    sketch = radiusAdd.sketch;
    const edit = createEditDimensionCommand(sketch, sketch.constraints.find((c) => c.type === "radius")!.id, {
      value: 20,
    });
    expect(edit.ok).toBe(true);
    if (!edit.ok) {
      return;
    }
    sketch = edit.command.apply(sketch);
    const circle = sketch.geometry.find((entity) => entity.id === created.circle.id);
    expect(circle?.type === "circle" && circle.center.x).toBeCloseTo(0, 5);
    expect(circle?.type === "circle" && circle.center.y).toBeCloseTo(0, 5);
    expect(circle?.type === "circle" && circle.radius).toBeCloseTo(20, 5);
    expect(solve(sketch).status).toBe("solved");
    expect(solve(sketch).degreesOfFreedom).toBe(0);
  });

  it("locates a rectangle with axis-offset dimensions (no coincident)", () => {
    // Draw anywhere, then locate with coordinate-x / coordinate-y (Offset Y / Offset X tools).
    let sketch = createAddRectangleCommand({ x: 20, y: 30 }, { x: 70, y: 55 })!.apply(
      createEmptySketch(),
    );
    const feature = sketch.constraints
      .map(parseRectangleFeature)
      .find((item) => item !== null)!;

    const offsetY = prepareAddConstraint(sketch, {
      type: "coordinate-y",
      references: [{ entityId: feature.corners.bl!, role: "position" }],
    });
    expect(offsetY.ok).toBe(true);
    if (!offsetY.ok) {
      return;
    }
    sketch = offsetY.sketch;

    const offsetX = prepareAddConstraint(sketch, {
      type: "coordinate-x",
      references: [{ entityId: feature.corners.bl!, role: "position" }],
    });
    expect(offsetX.ok).toBe(true);
    if (!offsetX.ok) {
      return;
    }
    sketch = offsetX.sketch;

    // Create-at-measured: geometry should not jump.
    const blBefore = sketch.geometry.find((e) => e.id === feature.corners.bl);
    expect(blBefore?.type === "point" && blBefore.position.x).toBeCloseTo(20, 5);
    expect(blBefore?.type === "point" && blBefore.position.y).toBeCloseTo(30, 5);

    const yId = sketch.constraints.find((c) => c.type === "coordinate-y")!.id;
    const xId = sketch.constraints.find((c) => c.type === "coordinate-x")!.id;
    const editY = createEditDimensionCommand(sketch, yId, { value: 10 });
    expect(editY.ok).toBe(true);
    if (!editY.ok) {
      return;
    }
    sketch = editY.command.apply(sketch);
    const editX = createEditDimensionCommand(sketch, xId, { value: 25 });
    expect(editX.ok).toBe(true);
    if (!editX.ok) {
      return;
    }
    sketch = editX.command.apply(sketch);

    const bl = sketch.geometry.find((e) => e.id === feature.corners.bl);
    expect(bl?.type === "point" && bl.position.x).toBeCloseTo(25, 4);
    expect(bl?.type === "point" && bl.position.y).toBeCloseTo(10, 4);

    const widthAdd = prepareAddConstraint(sketch, {
      type: "length",
      references: [{ entityId: feature.edges.bottom, role: "entity" }],
    });
    expect(widthAdd.ok).toBe(true);
    if (!widthAdd.ok) {
      return;
    }
    sketch = widthAdd.sketch;
    const heightAdd = prepareAddConstraint(sketch, {
      type: "length",
      references: [{ entityId: feature.edges.left, role: "entity" }],
    });
    expect(heightAdd.ok).toBe(true);
    if (!heightAdd.ok) {
      return;
    }
    sketch = heightAdd.sketch;

    expect(listUnsatisfiedConstraints(sketch)).toEqual([]);
    const result = solve(sketch);
    expect(result.status).toBe("solved");
    expect(result.degreesOfFreedom).toBe(0);
  });

  it("allows line-body drag on the right edge to widen a located rectangle", () => {
    let sketch = createAddRectangleCommand({ x: 20, y: 30 }, { x: 70, y: 55 })!.apply(
      createEmptySketch(),
    );
    const feature = sketch.constraints
      .map(parseRectangleFeature)
      .find((item) => item !== null)!;

    const offsetY = prepareAddConstraint(sketch, {
      type: "coordinate-y",
      references: [{ entityId: feature.corners.bl!, role: "position" }],
    });
    expect(offsetY.ok).toBe(true);
    if (!offsetY.ok) {
      return;
    }
    sketch = offsetY.sketch;

    const offsetX = prepareAddConstraint(sketch, {
      type: "coordinate-x",
      references: [{ entityId: feature.corners.bl!, role: "position" }],
    });
    expect(offsetX.ok).toBe(true);
    if (!offsetX.ok) {
      return;
    }
    sketch = offsetX.sketch;

    const yId = sketch.constraints.find((c) => c.type === "coordinate-y")!.id;
    const xId = sketch.constraints.find((c) => c.type === "coordinate-x")!.id;
    const editY = createEditDimensionCommand(sketch, yId, { value: 10 });
    expect(editY.ok).toBe(true);
    if (!editY.ok) {
      return;
    }
    sketch = editY.command.apply(sketch);
    const editX = createEditDimensionCommand(sketch, xId, { value: 25 });
    expect(editX.ok).toBe(true);
    if (!editX.ok) {
      return;
    }
    sketch = editX.command.apply(sketch);

    const right = sketch.geometry.find((e) => e.id === feature.edges.right);
    expect(right?.type).toBe("line");
    if (right?.type !== "line") {
      return;
    }

    const dragged = applyGeometryDragWithConstraints(
      sketch,
      {
        kind: "line-body",
        entityId: feature.edges.right,
        grabOffset: { x: 0, y: 0 },
        span: { x: 0, y: right.end.y - right.start.y },
      },
      { x: 120, y: (right.start.y + right.end.y) / 2 },
    );
    expect(dragged).not.toBe(sketch);
    const rightAfter = dragged.geometry.find((e) => e.id === feature.edges.right);
    expect(rightAfter?.type).toBe("line");
    if (rightAfter?.type !== "line") {
      return;
    }
    expect(rightAfter.start.x).toBeCloseTo(120, 4);
    const bl = dragged.geometry.find((e) => e.id === feature.corners.bl);
    expect(bl?.type === "point" && bl.position.x).toBeCloseTo(25, 4);
    expect(bl?.type === "point" && bl.position.y).toBeCloseTo(10, 4);
    expect(listUnsatisfiedConstraints(dragged)).toEqual([]);
  });

  it("hit-tests origin and axes at extreme zoom", () => {
    const sketch = createEmptySketch();
    const zoomedIn = createCamera(800, 600, 50);
    const zoomedOut = createCamera(800, 600, 0.2);

    expect(
      hitTestSketch(sketch, { x: 0, y: 0 }, { camera: zoomedIn })?.entityId,
    ).toBe(DATUM_ORIGIN_ID);
    expect(
      hitTestSketch(sketch, { x: 30, y: 0 }, { camera: zoomedIn })?.entityId,
    ).toBe(DATUM_AXIS_X_ID);
    expect(
      hitTestSketch(sketch, { x: 0, y: 40 }, { camera: zoomedOut })?.entityId,
    ).toBe(DATUM_AXIS_Y_ID);
  });

  it("snaps to frame axes", () => {
    const sketch = createEmptySketch();
    const camera = createCamera(800, 600, 2);
    const snap = findSnap(
      { x: 25, y: 0.2 },
      sketch.geometry,
      { camera, gridSpacingMm: 10, frame: sketch.frame, tolerancePx: 8 },
    );
    expect(snap?.type).toBe("axis");
    expect(snap?.sourceEntityId).toBe(DATUM_AXIS_X_ID);
    expect(snap?.point.y ?? 1).toBeLessThanOrEqual(TOLERANCE.coincidence);
  });
});
