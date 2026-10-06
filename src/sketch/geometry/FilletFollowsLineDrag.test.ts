import { beforeEach, describe, expect, it } from "vitest";
import { addLineToSketch } from "../commands/CreateGeometryCommand.ts";
import { applyGeometryDrag } from "../commands/MovePointCommand.ts";
import { applyGeometryDragWithConstraints } from "../commands/GeometryEdit.ts";
import { createAddMaintainedConstraintCommand } from "../commands/AddMaintainedConstraintCommand.ts";
import { createEditDimensionCommand } from "../commands/EditDimensionCommand.ts";
import { listUnsatisfiedConstraints } from "../constraints/ConstraintMaintenance.ts";
import { applyFilletLines } from "./FilletChamferOps.ts";
import { distance, pointsApproximatelyEqual } from "./GeometryMath.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { createEmptySketch } from "../model/Sketch.ts";
import { createAddRectangleCommand } from "../commands/CreateRectangleCommand.ts";
import { parseRectangleFeature } from "../model/RectangleFeature.ts";
import type { ArcGeometry, LineGeometry } from "../model/Geometry.ts";

function arcEndpoints(arc: ArcGeometry): { start: { x: number; y: number }; end: { x: number; y: number } } {
  return {
    start: {
      x: arc.center.x + arc.radius * Math.cos(arc.startAngle),
      y: arc.center.y + arc.radius * Math.sin(arc.startAngle),
    },
    end: {
      x: arc.center.x + arc.radius * Math.cos(arc.endAngle),
      y: arc.center.y + arc.radius * Math.sin(arc.endAngle),
    },
  };
}

function lineTouchesPoint(line: LineGeometry, point: { x: number; y: number }): boolean {
  return (
    pointsApproximatelyEqual(line.start, point, 1e-4) ||
    pointsApproximatelyEqual(line.end, point, 1e-4)
  );
}

describe("fillet follows line drag", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("rebuilds the fillet when a connected vertical line is translated", () => {
    let sketch = createEmptySketch();
    sketch = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 100, y: 0 })!.sketch;
    sketch = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 0, y: 80 })!.sketch;
    const hId = sketch.geometry[0]!.id;
    const vId = sketch.geometry[1]!.id;

    const filleted = applyFilletLines(sketch, hId, vId, { x: 8, y: 8 }, 10);
    expect(filleted.ok).toBe(true);
    if (!filleted.ok) {
      return;
    }
    sketch = filleted.sketch;

    // Translate the vertical line 20 mm to the right (body drag).
    sketch = applyGeometryDrag(
      sketch,
      {
        kind: "line-body",
        entityId: vId,
        grabOffset: { x: 0, y: 0 },
        span: { x: 0, y: 80 },
      },
      { x: 20, y: 40 },
    );

    const vLine = sketch.geometry.find((e) => e.id === vId);
    const hLine = sketch.geometry.find((e) => e.id === hId);
    const arc = sketch.geometry.find((e) => e.type === "arc");
    expect(vLine?.type).toBe("line");
    expect(hLine?.type).toBe("line");
    expect(arc?.type).toBe("arc");
    if (vLine?.type !== "line" || hLine?.type !== "line" || arc?.type !== "arc") {
      return;
    }

    expect(vLine.start.x).toBeCloseTo(20, 5);
    expect(vLine.end.x).toBeCloseTo(20, 5);
    expect(arc.radius).toBeCloseTo(10, 5);

    const ends = arcEndpoints(arc);
    expect(
      lineTouchesPoint(hLine, ends.start) || lineTouchesPoint(hLine, ends.end),
    ).toBe(true);
    expect(
      lineTouchesPoint(vLine, ends.start) || lineTouchesPoint(vLine, ends.end),
    ).toBe(true);
    // Arc should have moved with the corner (center near x=30 for R=10 at x=20).
    expect(arc.center.x).toBeCloseTo(30, 1);
  });

  it("rebuilds both fillets on a shared rectangle edge when that edge moves", () => {
    const add = createAddRectangleCommand({ x: 0, y: 0 }, { x: 100, y: 50 })!;
    let sketch = add.apply(createEmptySketch());
    const rect = parseRectangleFeature(
      sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;

    let outcome = applyFilletLines(
      sketch,
      rect.edges.bottom,
      rect.edges.right,
      { x: 90, y: 10 },
      8,
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }
    sketch = outcome.sketch;

    outcome = applyFilletLines(
      sketch,
      rect.edges.right,
      rect.edges.top,
      { x: 90, y: 40 },
      8,
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }
    sketch = outcome.sketch;

    const rightBefore = sketch.geometry.find((e) => e.id === rect.edges.right);
    expect(rightBefore?.type).toBe("line");
    if (rightBefore?.type !== "line") {
      return;
    }

    sketch = applyGeometryDrag(
      sketch,
      {
        kind: "line-body",
        entityId: rect.edges.right,
        grabOffset: { x: 0, y: 0 },
        span: {
          x: rightBefore.end.x - rightBefore.start.x,
          y: rightBefore.end.y - rightBefore.start.y,
        },
      },
      { x: 110, y: 25 },
    );

    const arcs = sketch.geometry.filter((e) => e.type === "arc");
    expect(arcs).toHaveLength(2);
    const right = sketch.geometry.find((e) => e.id === rect.edges.right);
    expect(right?.type).toBe("line");
    if (right?.type !== "line") {
      return;
    }
    expect(right.start.x).toBeCloseTo(110, 1);
    expect(right.end.x).toBeCloseTo(110, 1);

    for (const arcEntity of arcs) {
      if (arcEntity.type !== "arc") {
        continue;
      }
      const ends = arcEndpoints(arcEntity);
      const touchesRight =
        lineTouchesPoint(right, ends.start) || lineTouchesPoint(right, ends.end);
      expect(touchesRight).toBe(true);
      expect(distance(ends.start, ends.end)).toBeGreaterThan(1);
    }
  });

  it("keeps all fillets joined after constrained drag with an edge length dimension", () => {
    const add = createAddRectangleCommand({ x: 0, y: 0 }, { x: 100, y: 50 })!;
    let sketch = add.apply(createEmptySketch());
    const rect = parseRectangleFeature(
      sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;

    const corners = [
      { a: rect.edges.bottom, b: rect.edges.right, pick: { x: 90, y: 10 } },
      { a: rect.edges.right, b: rect.edges.top, pick: { x: 90, y: 40 } },
      { a: rect.edges.top, b: rect.edges.left, pick: { x: 10, y: 40 } },
      { a: rect.edges.left, b: rect.edges.bottom, pick: { x: 10, y: 10 } },
    ] as const;

    for (const corner of corners) {
      const outcome = applyFilletLines(sketch, corner.a, corner.b, corner.pick, 8);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) {
        return;
      }
      sketch = outcome.sketch;
    }
    expect(sketch.geometry.filter((e) => e.type === "arc")).toHaveLength(4);

    // Driving length on the right vertical edge (post-fillet remaining segment).
    const lengthCmd = createAddMaintainedConstraintCommand(sketch, {
      type: "length",
      references: [{ entityId: rect.edges.right, role: "entity" }],
    });
    expect(lengthCmd.ok).toBe(true);
    if (!lengthCmd.ok) {
      return;
    }
    sketch = lengthCmd.command.apply(sketch);

    const rightBefore = sketch.geometry.find((e) => e.id === rect.edges.right);
    expect(rightBefore?.type).toBe("line");
    if (rightBefore?.type !== "line") {
      return;
    }

    // Select-tool path: drag + maintainConstraints (solver) — previously broke fillets.
    sketch = applyGeometryDragWithConstraints(
      sketch,
      {
        kind: "line-body",
        entityId: rect.edges.right,
        grabOffset: { x: 0, y: 0 },
        span: {
          x: rightBefore.end.x - rightBefore.start.x,
          y: rightBefore.end.y - rightBefore.start.y,
        },
      },
      { x: 120, y: 25 },
    );

    const right = sketch.geometry.find((e) => e.id === rect.edges.right);
    expect(right?.type).toBe("line");
    if (right?.type !== "line") {
      return;
    }
    expect(right.start.x).toBeCloseTo(120, 1);
    expect(right.end.x).toBeCloseTo(120, 1);

    const arcs = sketch.geometry.filter((e) => e.type === "arc");
    expect(arcs).toHaveLength(4);

    for (const arcEntity of arcs) {
      if (arcEntity.type !== "arc") {
        continue;
      }
      const ends = arcEndpoints(arcEntity);
      const line1 = sketch.geometry.find(
        (e) =>
          e.type === "line" &&
          (lineTouchesPoint(e, ends.start) || lineTouchesPoint(e, ends.end)),
      );
      const line2 = sketch.geometry.find(
        (e) =>
          e.type === "line" &&
          e.id !== line1?.id &&
          (lineTouchesPoint(e, ends.start) || lineTouchesPoint(e, ends.end)),
      );
      expect(line1, `arc ${arcEntity.id} start/end must touch a line`).toBeDefined();
      expect(line2, `arc ${arcEntity.id} must touch two lines`).toBeDefined();
    }
  });

  it("keeps fillets joined under extreme stepwise bottom drag (y to -150)", () => {
    const add = createAddRectangleCommand({ x: 0, y: 0 }, { x: 100, y: 50 })!;
    let sketch = add.apply(createEmptySketch());
    const rect = parseRectangleFeature(
      sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;

    for (const corner of [
      { a: rect.edges.bottom, b: rect.edges.right, pick: { x: 90, y: 10 } },
      { a: rect.edges.right, b: rect.edges.top, pick: { x: 90, y: 40 } },
      { a: rect.edges.top, b: rect.edges.left, pick: { x: 10, y: 40 } },
      { a: rect.edges.left, b: rect.edges.bottom, pick: { x: 10, y: 10 } },
    ] as const) {
      const outcome = applyFilletLines(sketch, corner.a, corner.b, corner.pick, 8);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) {
        return;
      }
      sketch = outcome.sketch;
    }

    const lengthCmd = createAddMaintainedConstraintCommand(sketch, {
      type: "length",
      references: [{ entityId: rect.edges.right, role: "entity" }],
    });
    expect(lengthCmd.ok).toBe(true);
    if (!lengthCmd.ok) {
      return;
    }
    sketch = lengthCmd.command.apply(sketch);
    const drivingLength = sketch.constraints.find(
      (c) => c.type === "length" && c.references[0]?.entityId === rect.edges.right,
    )!.value!;

    for (const y of [-10, -30, -60, -100, -150]) {
      const bottom = sketch.geometry.find((e) => e.id === rect.edges.bottom);
      expect(bottom?.type).toBe("line");
      if (bottom?.type !== "line") {
        return;
      }
      sketch = applyGeometryDragWithConstraints(
        sketch,
        {
          kind: "line-body",
          entityId: rect.edges.bottom,
          grabOffset: { x: 0, y: 0 },
          span: {
            x: bottom.end.x - bottom.start.x,
            y: bottom.end.y - bottom.start.y,
          },
        },
        { x: 50, y },
      );

      const right = sketch.geometry.find((e) => e.id === rect.edges.right);
      expect(right?.type).toBe("line");
      if (right?.type !== "line") {
        return;
      }
      expect(
        distance(right.start, right.end),
        `right length at y=${y}`,
      ).toBeCloseTo(drivingLength, 3);
      expect(listUnsatisfiedConstraints(sketch), `unsat at y=${y}`).toEqual([]);

      const bottomAfter = sketch.geometry.find((e) => e.id === rect.edges.bottom);
      expect(bottomAfter?.type).toBe("line");
      if (bottomAfter?.type !== "line") {
        return;
      }
      expect(bottomAfter.start.y, `bottom y at step ${y}`).toBeCloseTo(y, 1);
      expect(bottomAfter.end.y, `bottom y at step ${y}`).toBeCloseTo(y, 1);

      for (const arcEntity of sketch.geometry.filter((e) => e.type === "arc")) {
        if (arcEntity.type !== "arc") {
          continue;
        }
        const ends = arcEndpoints(arcEntity);
        const touches = sketch.geometry.filter(
          (e): e is LineGeometry =>
            e.type === "line" &&
            (lineTouchesPoint(e, ends.start) || lineTouchesPoint(e, ends.end)),
        );
        expect(
          touches.length,
          `arc ${arcEntity.id} disconnected at y=${y}`,
        ).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("keeps driving length when dragging a perpendicular edge on a filleted rectangle", () => {
    const add = createAddRectangleCommand({ x: 0, y: 0 }, { x: 100, y: 50 })!;
    let sketch = add.apply(createEmptySketch());
    const rect = parseRectangleFeature(
      sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;

    for (const corner of [
      { a: rect.edges.bottom, b: rect.edges.right, pick: { x: 90, y: 10 } },
      { a: rect.edges.right, b: rect.edges.top, pick: { x: 90, y: 40 } },
      { a: rect.edges.top, b: rect.edges.left, pick: { x: 10, y: 40 } },
      { a: rect.edges.left, b: rect.edges.bottom, pick: { x: 10, y: 10 } },
    ] as const) {
      const outcome = applyFilletLines(sketch, corner.a, corner.b, corner.pick, 8);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) {
        return;
      }
      sketch = outcome.sketch;
    }

    const lengthCmd = createAddMaintainedConstraintCommand(sketch, {
      type: "length",
      references: [{ entityId: rect.edges.right, role: "entity" }],
    });
    expect(lengthCmd.ok).toBe(true);
    if (!lengthCmd.ok) {
      return;
    }
    sketch = lengthCmd.command.apply(sketch);
    const length = sketch.constraints.find(
      (c) => c.type === "length" && c.references[0]?.entityId === rect.edges.right,
    )!;
    const drivingLength = length.value!;

    const bottom = sketch.geometry.find((e) => e.id === rect.edges.bottom);
    expect(bottom?.type).toBe("line");
    if (bottom?.type !== "line") {
      return;
    }

    sketch = applyGeometryDragWithConstraints(
      sketch,
      {
        kind: "line-body",
        entityId: rect.edges.bottom,
        grabOffset: { x: 0, y: 0 },
        span: {
          x: bottom.end.x - bottom.start.x,
          y: bottom.end.y - bottom.start.y,
        },
      },
      { x: 50, y: -40 },
    );

    const right = sketch.geometry.find((e) => e.id === rect.edges.right);
    expect(right?.type).toBe("line");
    if (right?.type !== "line") {
      return;
    }
    expect(distance(right.start, right.end)).toBeCloseTo(drivingLength, 3);
    expect(listUnsatisfiedConstraints(sketch)).toEqual([]);

    const bottomAfter = sketch.geometry.find((e) => e.id === rect.edges.bottom);
    expect(bottomAfter?.type).toBe("line");
    if (bottomAfter?.type !== "line") {
      return;
    }
    // Profile should translate with the drag, not stretch the driving edge.
    expect(bottomAfter.start.y).toBeCloseTo(-40, 1);
    expect(bottomAfter.end.y).toBeCloseTo(-40, 1);

    for (const arcEntity of sketch.geometry.filter((e) => e.type === "arc")) {
      if (arcEntity.type !== "arc") {
        continue;
      }
      const ends = arcEndpoints(arcEntity);
      const touches = sketch.geometry.filter(
        (e): e is LineGeometry =>
          e.type === "line" &&
          (lineTouchesPoint(e, ends.start) || lineTouchesPoint(e, ends.end)),
      );
      expect(touches.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("edits length on a fully filleted rectangle edge without breaking blends", () => {
    const add = createAddRectangleCommand({ x: 0, y: 0 }, { x: 100, y: 50 })!;
    let sketch = add.apply(createEmptySketch());
    const rect = parseRectangleFeature(
      sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;

    for (const corner of [
      { a: rect.edges.bottom, b: rect.edges.right, pick: { x: 90, y: 10 } },
      { a: rect.edges.right, b: rect.edges.top, pick: { x: 90, y: 40 } },
      { a: rect.edges.top, b: rect.edges.left, pick: { x: 10, y: 40 } },
      { a: rect.edges.left, b: rect.edges.bottom, pick: { x: 10, y: 10 } },
    ] as const) {
      const outcome = applyFilletLines(sketch, corner.a, corner.b, corner.pick, 8);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) {
        return;
      }
      sketch = outcome.sketch;
    }

    const lengthCmd = createAddMaintainedConstraintCommand(sketch, {
      type: "length",
      references: [{ entityId: rect.edges.right, role: "entity" }],
    });
    expect(lengthCmd.ok).toBe(true);
    if (!lengthCmd.ok) {
      return;
    }
    sketch = lengthCmd.command.apply(sketch);
    const lengthId = sketch.constraints.find(
      (c) => c.type === "length" && c.references[0]?.entityId === rect.edges.right,
    )!.id;

    const edit = createEditDimensionCommand(sketch, lengthId, { value: 50 });
    expect(edit.ok).toBe(true);
    if (!edit.ok) {
      return;
    }
    sketch = edit.command.apply(sketch);

    const right = sketch.geometry.find((e) => e.id === rect.edges.right);
    expect(right?.type).toBe("line");
    if (right?.type !== "line") {
      return;
    }
    expect(distance(right.start, right.end)).toBeCloseTo(50, 3);
    expect(sketch.constraints.find((c) => c.id === lengthId)?.value).toBe(50);

    const arcs = sketch.geometry.filter((e) => e.type === "arc");
    expect(arcs).toHaveLength(4);
    for (const arcEntity of arcs) {
      if (arcEntity.type !== "arc") {
        continue;
      }
      const ends = arcEndpoints(arcEntity);
      const touches = sketch.geometry.filter(
        (e): e is LineGeometry =>
          e.type === "line" &&
          (lineTouchesPoint(e, ends.start) || lineTouchesPoint(e, ends.end)),
      );
      expect(touches.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("edits fillet radius on a located 100×100 box without changing length dims", () => {
    // User workflow: size with Length on the filleted edges, locate with Offset X/Y,
    // fillet TR, then change radius — previously rejected as conflicting with Length.
    let sketch = createAddRectangleCommand({ x: 0, y: 0 }, { x: 100, y: 100 })!.apply(
      createEmptySketch(),
    );
    let feature = sketch.constraints
      .map(parseRectangleFeature)
      .find((item) => item !== null)!;

    for (const edge of [feature.edges.top, feature.edges.right] as const) {
      const add = createAddMaintainedConstraintCommand(sketch, {
        type: "length",
        references: [{ entityId: edge, role: "entity" }],
      });
      expect(add.ok).toBe(true);
      if (!add.ok) {
        return;
      }
      sketch = add.command.apply(sketch);
      const length = sketch.constraints.filter((c) => c.type === "length").at(-1)!;
      expect(length.value).toBeCloseTo(100, 5);
    }

    for (const type of ["coordinate-y", "coordinate-x"] as const) {
      const add = createAddMaintainedConstraintCommand(sketch, {
        type,
        references: [{ entityId: feature.corners.bl!, role: "position" }],
      });
      expect(add.ok).toBe(true);
      if (!add.ok) {
        return;
      }
      sketch = add.command.apply(sketch);
    }
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

    feature = sketch.constraints
      .map(parseRectangleFeature)
      .find((item) => item !== null)!;
    const filleted = applyFilletLines(
      sketch,
      feature.edges.top,
      feature.edges.right,
      { x: 90, y: 90 },
      10,
    );
    expect(filleted.ok).toBe(true);
    if (!filleted.ok) {
      return;
    }
    sketch = filleted.sketch;

    const radiusId = sketch.constraints.find((c) => c.type === "radius")!.id;
    const lengthValuesBefore = sketch.constraints
      .filter((c) => c.type === "length")
      .map((c) => c.value);

    for (const nextRadius of [15, 5, 20] as const) {
      const edited = createEditDimensionCommand(sketch, radiusId, {
        value: nextRadius,
      });
      expect(edited.ok).toBe(true);
      if (!edited.ok) {
        return;
      }
      sketch = edited.command.apply(sketch);
      const arc = sketch.geometry.find((e) => e.type === "arc");
      expect(arc?.type).toBe("arc");
      if (arc?.type !== "arc") {
        return;
      }
      expect(arc.radius).toBeCloseTo(nextRadius, 3);
      expect(listUnsatisfiedConstraints(sketch)).toEqual([]);
      expect(
        sketch.constraints.filter((c) => c.type === "length").map((c) => c.value),
      ).toEqual(lengthValuesBefore);
      for (const length of sketch.constraints.filter((c) => c.type === "length")) {
        const line = sketch.geometry.find(
          (e) => e.id === length.references[0]?.entityId,
        );
        expect(line?.type).toBe("line");
        if (line?.type !== "line" || length.value === undefined) {
          return;
        }
        expect(distance(line.start, line.end)).toBeCloseTo(length.value, 2);
      }
    }
  });
});
