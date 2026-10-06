import { beforeEach, describe, expect, it } from "vitest";
import { createAddRectangleCommand } from "../commands/CreateRectangleCommand.ts";
import { createEditDimensionCommand } from "../commands/EditDimensionCommand.ts";
import { createAddMaintainedConstraintCommand } from "../commands/AddMaintainedConstraintCommand.ts";
import {
  applyChamferLines,
  applyFilletLines,
} from "../geometry/FilletChamferOps.ts";
import { listUnsatisfiedConstraints } from "../constraints/ConstraintMaintenance.ts";
import { analyzeDegreesOfFreedom } from "../constraints/DegreesOfFreedom.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { parseRectangleFeature } from "../model/RectangleFeature.ts";
import { createEmptySketch } from "../model/Sketch.ts";
import { distance } from "../geometry/GeometryMath.ts";
import { solve } from "../solver/Solver.ts";

describe("rectangle multi-fillet", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("can fillet all four rectangle corners in sequence", () => {
    const add = createAddRectangleCommand({ x: 0, y: 0 }, { x: 100, y: 50 })!;
    let sketch = add.apply(createEmptySketch());
    const rect = parseRectangleFeature(
      sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;

    const attempts = [
      {
        name: "br",
        a: rect.edges.bottom,
        b: rect.edges.right,
        pick: { x: 90, y: 10 },
      },
      {
        name: "tr",
        a: rect.edges.right,
        b: rect.edges.top,
        pick: { x: 90, y: 40 },
      },
      {
        name: "tl",
        a: rect.edges.top,
        b: rect.edges.left,
        pick: { x: 10, y: 40 },
      },
      {
        name: "bl",
        a: rect.edges.left,
        b: rect.edges.bottom,
        pick: { x: 10, y: 10 },
      },
    ] as const;

    for (const attempt of attempts) {
      const beforeCoincidents = sketch.constraints.filter(
        (c) => c.type === "coincident",
      );
      const outcome = applyFilletLines(
        sketch,
        attempt.a,
        attempt.b,
        attempt.pick,
        8,
      );
      if (!outcome.ok) {
        expect.fail(
          `${attempt.name} failed: ${outcome.reason}; coincidents before=${beforeCoincidents.length}; types=${sketch.constraints.map((c) => c.type).join(",")}`,
        );
      }
      sketch = outcome.sketch;
      expect(
        listUnsatisfiedConstraints(sketch),
        `${attempt.name} unsatisfied`,
      ).toEqual([]);

      const lineA = sketch.geometry.find((e) => e.id === attempt.a);
      const lineB = sketch.geometry.find((e) => e.id === attempt.b);
      expect(lineA?.type).toBe("line");
      expect(lineB?.type).toBe("line");
      if (lineA?.type === "line" && lineB?.type === "line") {
        expect(distance(lineA.start, lineA.end)).toBeGreaterThan(1);
        expect(distance(lineB.start, lineB.end)).toBeGreaterThan(1);
      }
    }

    expect(sketch.geometry.filter((e) => e.type === "arc")).toHaveLength(4);
    const opened = parseRectangleFeature(
      sketch.constraints.find((c) => c.type === "rectangle")!,
    );
    expect(opened).not.toBeNull();
    expect(opened!.corners.bl).toBeNull();
    expect(opened!.corners.br).toBeNull();
    expect(opened!.corners.tr).toBeNull();
    expect(opened!.corners.tl).toBeNull();
    expect(sketch.constraints.filter((c) => c.type === "fillet")).toHaveLength(4);
    expect(
      sketch.constraints.filter((c) => c.type === "coincident"),
    ).toHaveLength(0);
  });

  it("can chamfer all four rectangle corners in sequence", () => {
    const add = createAddRectangleCommand({ x: 0, y: 0 }, { x: 100, y: 50 })!;
    let sketch = add.apply(createEmptySketch());
    const rect = parseRectangleFeature(
      sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;

    const attempts = [
      { a: rect.edges.bottom, b: rect.edges.right, pick: { x: 90, y: 10 } },
      { a: rect.edges.right, b: rect.edges.top, pick: { x: 90, y: 40 } },
      { a: rect.edges.top, b: rect.edges.left, pick: { x: 10, y: 40 } },
      { a: rect.edges.left, b: rect.edges.bottom, pick: { x: 10, y: 10 } },
    ] as const;

    for (const attempt of attempts) {
      const outcome = applyChamferLines(
        sketch,
        attempt.a,
        attempt.b,
        attempt.pick,
        6,
      );
      expect(outcome.ok, outcome.ok ? "" : outcome.reason).toBe(true);
      if (!outcome.ok) {
        return;
      }
      sketch = outcome.sketch;
    }

    expect(sketch.constraints.filter((c) => c.type === "chamfer")).toHaveLength(
      4,
    );
    expect(parseRectangleFeature(
      sketch.constraints.find((c) => c.type === "rectangle")!,
    )).not.toBeNull();
    // Each chamfer adds two endpoint coincidents with its parents.
    expect(
      sketch.constraints.filter((c) => c.type === "coincident"),
    ).toHaveLength(8);
  });

  it("Offset on a blended edge translates the whole rectangle group", () => {
    let sketch = createAddRectangleCommand({ x: 0, y: 0 }, { x: 100, y: 100 })!.apply(
      createEmptySketch(),
    );
    const rect = parseRectangleFeature(
      sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;

    const filleted = applyFilletLines(
      sketch,
      rect.edges.top,
      rect.edges.right,
      { x: 90, y: 90 },
      10,
    );
    expect(filleted.ok).toBe(true);
    if (!filleted.ok) {
      return;
    }
    sketch = filleted.sketch;

    const chamfered = applyChamferLines(
      sketch,
      rect.edges.bottom,
      rect.edges.right,
      { x: 90, y: 10 },
      8,
    );
    expect(chamfered.ok).toBe(true);
    if (!chamfered.ok) {
      return;
    }
    sketch = chamfered.sketch;

    const bottom = sketch.geometry.find((e) => e.id === rect.edges.bottom);
    expect(bottom?.type).toBe("line");
    if (bottom?.type !== "line") {
      return;
    }
    const yBefore = bottom.start.y;

    const snapshot = new Map(
      sketch.geometry.map((entity) => [entity.id, structuredClone(entity)]),
    );

    const addOffset = createAddMaintainedConstraintCommand(sketch, {
      type: "coordinate-y",
      references: [{ entityId: rect.edges.bottom, role: "start" }],
    });
    expect(addOffset.ok).toBe(true);
    if (!addOffset.ok) {
      return;
    }
    sketch = addOffset.command.apply(sketch);

    const offsetId = sketch.constraints.find((c) => c.type === "coordinate-y")!.id;
    const edit = createEditDimensionCommand(sketch, offsetId, {
      value: yBefore + 25,
    });
    expect(edit.ok).toBe(true);
    if (!edit.ok) {
      return;
    }
    sketch = edit.command.apply(sketch);
    expect(listUnsatisfiedConstraints(sketch)).toEqual([]);

    for (const edgeId of [
      rect.edges.bottom,
      rect.edges.right,
      rect.edges.top,
      rect.edges.left,
    ]) {
      const before = snapshot.get(edgeId);
      const after = sketch.geometry.find((e) => e.id === edgeId);
      expect(before?.type).toBe("line");
      expect(after?.type).toBe("line");
      if (before?.type !== "line" || after?.type !== "line") {
        return;
      }
      expect(after.start.y).toBeCloseTo(before.start.y + 25, 4);
      expect(after.end.y).toBeCloseTo(before.end.y + 25, 4);
      expect(after.start.x).toBeCloseTo(before.start.x, 4);
      expect(after.end.x).toBeCloseTo(before.end.x, 4);
    }

    const arcBefore = [...snapshot.values()].find((e) => e.type === "arc");
    const arcAfter = sketch.geometry.find((e) => e.type === "arc");
    expect(arcBefore?.type).toBe("arc");
    expect(arcAfter?.type).toBe("arc");
    if (arcBefore?.type !== "arc" || arcAfter?.type !== "arc") {
      return;
    }
    expect(arcAfter.center.y).toBeCloseTo(arcBefore.center.y + 25, 4);
    expect(arcAfter.center.x).toBeCloseTo(arcBefore.center.x, 4);

    const chamferBefore = [...snapshot.values()].find(
      (e) =>
        e.type === "line" &&
        e.id !== rect.edges.bottom &&
        e.id !== rect.edges.right &&
        e.id !== rect.edges.top &&
        e.id !== rect.edges.left,
    );
    const chamferAfter = sketch.geometry.find(
      (e) => e.type === "line" && e.id === chamferBefore?.id,
    );
    expect(chamferBefore?.type).toBe("line");
    expect(chamferAfter?.type).toBe("line");
    if (chamferBefore?.type !== "line" || chamferAfter?.type !== "line") {
      return;
    }
    expect(chamferAfter.start.y).toBeCloseTo(chamferBefore.start.y + 25, 4);
    expect(chamferAfter.end.y).toBeCloseTo(chamferBefore.end.y + 25, 4);
  });

  it("opposing Offsets size the box without tearing fillets", () => {
    // Locate left/bottom at 0, then size with top Y=150 and right X=250.
    // Must not rigid-translate the opposite pin or leave fillets detached.
    let sketch = createAddRectangleCommand({ x: 10, y: 20 }, { x: 110, y: 80 })!.apply(
      createEmptySketch(),
    );
    const rect = parseRectangleFeature(
      sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;

    const corners = [
      { a: rect.edges.bottom, b: rect.edges.right, pick: { x: 100, y: 30 } },
      { a: rect.edges.right, b: rect.edges.top, pick: { x: 100, y: 70 } },
      { a: rect.edges.top, b: rect.edges.left, pick: { x: 20, y: 70 } },
      { a: rect.edges.left, b: rect.edges.bottom, pick: { x: 20, y: 30 } },
    ] as const;
    for (const corner of corners) {
      const outcome = applyFilletLines(sketch, corner.a, corner.b, corner.pick, 8);
      expect(outcome.ok, outcome.ok ? "" : outcome.reason).toBe(true);
      if (!outcome.ok) {
        return;
      }
      sketch = outcome.sketch;
    }
    expect(sketch.geometry.filter((e) => e.type === "arc")).toHaveLength(4);

    for (const { type, edge } of [
      { type: "coordinate-x" as const, edge: rect.edges.left },
      { type: "coordinate-y" as const, edge: rect.edges.bottom },
    ]) {
      const add = createAddMaintainedConstraintCommand(sketch, {
        type,
        references: [{ entityId: edge, role: "start" }],
      });
      expect(add.ok).toBe(true);
      if (!add.ok) {
        return;
      }
      sketch = add.command.apply(sketch);
    }
    const xLeft = sketch.constraints.find(
      (c) => c.type === "coordinate-x" && c.references[0]?.entityId === rect.edges.left,
    )!.id;
    const yBottom = sketch.constraints.find(
      (c) =>
        c.type === "coordinate-y" && c.references[0]?.entityId === rect.edges.bottom,
    )!.id;
    const locateX = createEditDimensionCommand(sketch, xLeft, { value: 0 });
    expect(locateX.ok).toBe(true);
    if (!locateX.ok) {
      return;
    }
    sketch = locateX.command.apply(sketch);
    const locateY = createEditDimensionCommand(sketch, yBottom, { value: 0 });
    expect(locateY.ok).toBe(true);
    if (!locateY.ok) {
      return;
    }
    sketch = locateY.command.apply(sketch);

    const addTop = createAddMaintainedConstraintCommand(sketch, {
      type: "coordinate-y",
      references: [{ entityId: rect.edges.top, role: "start" }],
    });
    expect(addTop.ok).toBe(true);
    if (!addTop.ok) {
      return;
    }
    sketch = addTop.command.apply(sketch);
    const yTop = sketch.constraints.find(
      (c) => c.type === "coordinate-y" && c.references[0]?.entityId === rect.edges.top,
    )!.id;
    const editTop = createEditDimensionCommand(sketch, yTop, { value: 150 });
    expect(editTop.ok, editTop.ok ? "" : editTop.reason).toBe(true);
    if (!editTop.ok) {
      return;
    }
    sketch = editTop.command.apply(sketch);

    const addRight = createAddMaintainedConstraintCommand(sketch, {
      type: "coordinate-x",
      references: [{ entityId: rect.edges.right, role: "start" }],
    });
    expect(addRight.ok).toBe(true);
    if (!addRight.ok) {
      return;
    }
    sketch = addRight.command.apply(sketch);
    const xRight = sketch.constraints.find(
      (c) =>
        c.type === "coordinate-x" && c.references[0]?.entityId === rect.edges.right,
    )!.id;
    const editRight = createEditDimensionCommand(sketch, xRight, { value: 250 });
    expect(editRight.ok, editRight.ok ? "" : editRight.reason).toBe(true);
    if (!editRight.ok) {
      return;
    }
    sketch = editRight.command.apply(sketch);

    expect(listUnsatisfiedConstraints(sketch)).toEqual([]);

    const left = sketch.geometry.find((e) => e.id === rect.edges.left);
    const right = sketch.geometry.find((e) => e.id === rect.edges.right);
    const bottom = sketch.geometry.find((e) => e.id === rect.edges.bottom);
    const top = sketch.geometry.find((e) => e.id === rect.edges.top);
    expect(left?.type).toBe("line");
    expect(right?.type).toBe("line");
    expect(bottom?.type).toBe("line");
    expect(top?.type).toBe("line");
    if (
      left?.type !== "line" ||
      right?.type !== "line" ||
      bottom?.type !== "line" ||
      top?.type !== "line"
    ) {
      return;
    }
    expect(left.start.x).toBeCloseTo(0, 3);
    expect(right.start.x).toBeCloseTo(250, 3);
    expect(bottom.start.y).toBeCloseTo(0, 3);
    expect(top.start.y).toBeCloseTo(150, 3);

    for (const arcEntity of sketch.geometry.filter((e) => e.type === "arc")) {
      if (arcEntity.type !== "arc") {
        continue;
      }
      const parents = sketch.constraints
        .filter((c) => c.type === "fillet")
        .find((c) => c.references.some((r) => r.entityId === arcEntity.id));
      expect(parents).toBeDefined();
      const lineIds = parents!.references
        .filter((r) => r.role === "first" || r.role === "second")
        .map((r) => r.entityId);
      for (const lineId of lineIds) {
        const parent = sketch.geometry.find((e) => e.id === lineId);
        expect(parent?.type).toBe("line");
        if (parent?.type !== "line") {
          return;
        }
        const distToInfinite = distancePointToInfiniteLine(
          arcEntity.center,
          parent.start,
          parent.end,
        );
        expect(distToInfinite).toBeCloseTo(arcEntity.radius, 2);
      }
    }
  });

  it("fully filleted box without locate/size dims keeps rigid+size DOF", () => {
    let sketch = createAddRectangleCommand({ x: 10, y: 20 }, { x: 210, y: 220 })!.apply(
      createEmptySketch(),
    );
    const rect = parseRectangleFeature(
      sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;
    const corners = [
      { a: rect.edges.bottom, b: rect.edges.right, pick: { x: 200, y: 30 } },
      { a: rect.edges.right, b: rect.edges.top, pick: { x: 200, y: 210 } },
      { a: rect.edges.top, b: rect.edges.left, pick: { x: 20, y: 210 } },
      { a: rect.edges.left, b: rect.edges.bottom, pick: { x: 20, y: 30 } },
    ] as const;
    for (const corner of corners) {
      const outcome = applyFilletLines(sketch, corner.a, corner.b, corner.pick, 20);
      expect(outcome.ok, outcome.ok ? "" : outcome.reason).toBe(true);
      if (!outcome.ok) {
        return;
      }
      sketch = outcome.sketch;
    }

    const dof = analyzeDegreesOfFreedom(sketch);
    // tx, ty, width, height — fillets must not claim FULLY CONSTRAINED.
    expect(dof.degreesOfFreedom).toBe(4);
    expect(solve(sketch).status).toBe("under-constrained");
  });

  it("filleted box with W×H lengths still needs locate DOF", () => {
    let sketch = createAddRectangleCommand({ x: 10, y: 20 }, { x: 210, y: 220 })!.apply(
      createEmptySketch(),
    );
    const rect = parseRectangleFeature(
      sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;
    const corners = [
      { a: rect.edges.bottom, b: rect.edges.right, pick: { x: 200, y: 30 } },
      { a: rect.edges.right, b: rect.edges.top, pick: { x: 200, y: 210 } },
      { a: rect.edges.top, b: rect.edges.left, pick: { x: 20, y: 210 } },
      { a: rect.edges.left, b: rect.edges.bottom, pick: { x: 20, y: 30 } },
    ] as const;
    for (const corner of corners) {
      const outcome = applyFilletLines(sketch, corner.a, corner.b, corner.pick, 20);
      expect(outcome.ok, outcome.ok ? "" : outcome.reason).toBe(true);
      if (!outcome.ok) {
        return;
      }
      sketch = outcome.sketch;
    }
    for (const edge of [rect.edges.bottom, rect.edges.left] as const) {
      const add = createAddMaintainedConstraintCommand(sketch, {
        type: "length",
        references: [{ entityId: edge, role: "object" }],
      });
      expect(add.ok, add.ok ? "" : add.reason).toBe(true);
      if (!add.ok) {
        return;
      }
      sketch = add.command.apply(sketch);
    }

    const dof = analyzeDegreesOfFreedom(sketch);
    expect(dof.degreesOfFreedom).toBe(2);
    expect(solve(sketch).status).toBe("under-constrained");
  });

  it("200×200 R20 filleted box with opposing Offsets is fully constrained", () => {
    let sketch = createAddRectangleCommand({ x: 0, y: 0 }, { x: 200, y: 200 })!.apply(
      createEmptySketch(),
    );
    const rect = parseRectangleFeature(
      sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;

    const corners = [
      { a: rect.edges.bottom, b: rect.edges.right, pick: { x: 190, y: 10 } },
      { a: rect.edges.right, b: rect.edges.top, pick: { x: 190, y: 190 } },
      { a: rect.edges.top, b: rect.edges.left, pick: { x: 10, y: 190 } },
      { a: rect.edges.left, b: rect.edges.bottom, pick: { x: 10, y: 10 } },
    ] as const;
    for (const corner of corners) {
      const outcome = applyFilletLines(sketch, corner.a, corner.b, corner.pick, 20);
      expect(outcome.ok, outcome.ok ? "" : outcome.reason).toBe(true);
      if (!outcome.ok) {
        return;
      }
      sketch = outcome.sketch;
    }

    for (const { type, edge, value } of [
      { type: "coordinate-x" as const, edge: rect.edges.left, value: 0 },
      { type: "coordinate-y" as const, edge: rect.edges.bottom, value: 0 },
      { type: "coordinate-x" as const, edge: rect.edges.right, value: 200 },
      { type: "coordinate-y" as const, edge: rect.edges.top, value: 200 },
    ]) {
      const add = createAddMaintainedConstraintCommand(sketch, {
        type,
        references: [{ entityId: edge, role: "start" }],
      });
      expect(add.ok).toBe(true);
      if (!add.ok) {
        return;
      }
      sketch = add.command.apply(sketch);
      const id = sketch.constraints.find(
        (c) => c.type === type && c.references[0]?.entityId === edge,
      )!.id;
      const measured = sketch.constraints.find((c) => c.id === id)!.value!;
      if (Math.abs(measured - value) > 1e-6) {
        const edited = createEditDimensionCommand(sketch, id, { value });
        expect(edited.ok, edited.ok ? "" : edited.reason).toBe(true);
        if (!edited.ok) {
          return;
        }
        sketch = edited.command.apply(sketch);
      }
    }

    expect(listUnsatisfiedConstraints(sketch)).toEqual([]);
    const dof = analyzeDegreesOfFreedom(sketch);
    expect(dof.degreesOfFreedom).toBe(0);
    const result = solve(sketch);
    expect(result.status).toBe("solved");
    expect(result.degreesOfFreedom).toBe(0);
  });
});

function distancePointToInfiniteLine(
  point: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-12) {
    return distance(point, a);
  }
  return Math.abs((point.x - a.x) * dy - (point.y - a.y) * dx) / len;
}