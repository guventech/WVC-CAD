import { beforeEach, describe, expect, it } from "vitest";
import { createAddMaintainedConstraintCommand } from "../commands/AddMaintainedConstraintCommand.ts";
import { createAddRectangleCommand } from "../commands/CreateRectangleCommand.ts";
import { createEditDimensionCommand } from "../commands/EditDimensionCommand.ts";
import { applyGeometryDragWithConstraints } from "../commands/GeometryEdit.ts";
import { listUnsatisfiedConstraints } from "../constraints/ConstraintMaintenance.ts";
import { orientationResidual } from "../constraints/Orientation.ts";
import { applyFilletLines } from "../geometry/FilletChamferOps.ts";
import { TOLERANCE } from "../geometry/GeometryMath.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import type { LineGeometry } from "../model/Geometry.ts";
import { parseRectangleFeature } from "../model/RectangleFeature.ts";
import { createEmptySketch, type Sketch } from "../model/Sketch.ts";
import { solveSketch } from "../solver/Solver.ts";

function lineOf(sketch: Sketch, id: string): LineGeometry {
  const entity = sketch.geometry.find((item) => item.id === id);
  if (entity?.type !== "line") {
    throw new Error(`line ${id} missing`);
  }
  return entity;
}

function expectAxisAlignedEdges(sketch: Sketch, edgeIds: readonly string[]): void {
  for (const id of edgeIds) {
    const line = lineOf(sketch, id);
    const dx = Math.abs(line.start.x - line.end.x);
    const dy = Math.abs(line.start.y - line.end.y);
    const isH = dy <= TOLERANCE.coincidence;
    const isV = dx <= TOLERANCE.coincidence;
    expect(isH || isV, `${id} not axis-aligned (dx=${dx}, dy=${dy})`).toBe(true);
  }
}

function buildFilletedOffsetRect(): Sketch {
  const add = createAddRectangleCommand({ x: 60, y: 60 }, { x: 260, y: 160 })!;
  let sketch = add.apply(createEmptySketch());
  const rect = parseRectangleFeature(
    sketch.constraints.find((c) => c.type === "rectangle")!,
  )!;

  const tl = applyFilletLines(
    sketch,
    rect.edges.top,
    rect.edges.left,
    { x: 70, y: 150 },
    15,
  );
  expect(tl.ok).toBe(true);
  if (!tl.ok) {
    throw new Error(tl.reason);
  }
  sketch = tl.sketch;

  const tr = applyFilletLines(
    sketch,
    rect.edges.top,
    rect.edges.right,
    { x: 250, y: 150 },
    15,
  );
  expect(tr.ok).toBe(true);
  if (!tr.ok) {
    throw new Error(tr.reason);
  }
  sketch = tr.sketch;

  const addX = createAddMaintainedConstraintCommand(sketch, {
    type: "coordinate-x",
    references: [{ entityId: rect.edges.left, role: "start" }],
  });
  expect(addX.ok).toBe(true);
  if (!addX.ok) {
    throw new Error(addX.reason);
  }
  sketch = addX.command.apply(sketch);

  const addY = createAddMaintainedConstraintCommand(sketch, {
    type: "coordinate-y",
    references: [{ entityId: rect.edges.bottom, role: "start" }],
  });
  expect(addY.ok).toBe(true);
  if (!addY.ok) {
    throw new Error(addY.reason);
  }
  sketch = addY.command.apply(sketch);

  const addLen = createAddMaintainedConstraintCommand(sketch, {
    type: "length",
    references: [{ entityId: rect.edges.bottom, role: "entity" }],
  });
  expect(addLen.ok).toBe(true);
  if (!addLen.ok) {
    throw new Error(addLen.reason);
  }
  sketch = addLen.command.apply(sketch);

  expect(listUnsatisfiedConstraints(sketch)).toEqual([]);
  expectAxisAlignedEdges(sketch, [
    rect.edges.bottom,
    rect.edges.right,
    rect.edges.top,
    rect.edges.left,
  ]);
  return sketch;
}

describe("orientation uses true line endpoints (filleted rectangle)", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("detects a slanted rectangle edge even when corner points remain axis-aligned", () => {
    const add = createAddRectangleCommand({ x: 0, y: 0 }, { x: 100, y: 50 })!;
    let sketch = add.apply(createEmptySketch());
    const rect = parseRectangleFeature(
      sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;

    // Open TL so left.start no longer maps to a corner point entity.
    const filleted = applyFilletLines(
      sketch,
      rect.edges.top,
      rect.edges.left,
      { x: 10, y: 40 },
      8,
    );
    expect(filleted.ok).toBe(true);
    if (!filleted.ok) {
      return;
    }
    sketch = filleted.sketch;

    // Artificially skew the left edge while leaving the BL corner point at x=0.
    sketch = {
      ...sketch,
      geometry: sketch.geometry.map((entity) => {
        if (entity.id !== rect.edges.left || entity.type !== "line") {
          return entity;
        }
        return {
          ...entity,
          end: { x: -20, y: entity.end.y },
        };
      }),
    };

    const vertical = sketch.constraints.find(
      (c) =>
        c.type === "vertical" &&
        c.references[0]?.entityId === rect.edges.left,
    )!;
    const residual = orientationResidual(sketch, vertical);
    expect(residual).not.toBeNull();
    expect(residual!).toBeGreaterThan(TOLERANCE.coincidence);
    expect(listUnsatisfiedConstraints(sketch)).toContain(vertical.id);
  });

  it("keeps H/V edges after length and drag edits on a top-filleted rectangle", () => {
    let sketch = buildFilletedOffsetRect();
    const rect = parseRectangleFeature(
      sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;
    const length = sketch.constraints.find((c) => c.type === "length")!;

    const edited = createEditDimensionCommand(sketch, length.id, { value: 220 });
    expect(edited.ok).toBe(true);
    if (!edited.ok) {
      return;
    }
    sketch = edited.command.apply(sketch);
    expect(listUnsatisfiedConstraints(sketch)).toEqual([]);
    expectAxisAlignedEdges(sketch, [
      rect.edges.bottom,
      rect.edges.right,
      rect.edges.top,
      rect.edges.left,
    ]);

    const bottom = lineOf(sketch, rect.edges.bottom);
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
      {
        x: (bottom.start.x + bottom.end.x) / 2,
        y: (bottom.start.y + bottom.end.y) / 2 + 8,
      },
    );
    expect(listUnsatisfiedConstraints(sketch)).toEqual([]);
    expectAxisAlignedEdges(sketch, [
      rect.edges.bottom,
      rect.edges.right,
      rect.edges.top,
      rect.edges.left,
    ]);
  });

  it("keeps verticals when editing the bottom length value several times", () => {
    let sketch = buildFilletedOffsetRect();
    const rect = parseRectangleFeature(
      sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;
    const length = sketch.constraints.find((c) => c.type === "length")!;

    for (const value of [180, 200, 240, 200]) {
      const edited = createEditDimensionCommand(sketch, length.id, { value });
      expect(edited.ok, `edit to ${value}`).toBe(true);
      if (!edited.ok) {
        return;
      }
      sketch = edited.command.apply(sketch);
      expect(
        listUnsatisfiedConstraints(sketch),
        `unsatisfied after length=${value}`,
      ).toEqual([]);
      const left = lineOf(sketch, rect.edges.left);
      const right = lineOf(sketch, rect.edges.right);
      expect(Math.abs(left.start.x - left.end.x)).toBeLessThan(
        TOLERANCE.coincidence,
      );
      expect(Math.abs(right.start.x - right.end.x)).toBeLessThan(
        TOLERANCE.coincidence,
      );
    }
  });
});

describe("filleted rectangle orientation recovery", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("solveSketch restores a skewed vertical edge after top fillet", () => {
    const add = createAddRectangleCommand({ x: 0, y: 0 }, { x: 100, y: 50 })!;
    let sketch = add.apply(createEmptySketch());
    const rect = parseRectangleFeature(
      sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;
    const filleted = applyFilletLines(
      sketch,
      rect.edges.top,
      rect.edges.left,
      { x: 10, y: 40 },
      8,
    );
    expect(filleted.ok).toBe(true);
    if (!filleted.ok) {
      return;
    }
    sketch = {
      ...filleted.sketch,
      geometry: filleted.sketch.geometry.map((entity) => {
        if (entity.id !== rect.edges.left || entity.type !== "line") {
          return entity;
        }
        return { ...entity, end: { x: entity.end.x - 18, y: entity.end.y } };
      }),
    };

    const vertical = sketch.constraints.find(
      (c) =>
        c.type === "vertical" &&
        c.references[0]?.entityId === rect.edges.left,
    )!;
    expect(listUnsatisfiedConstraints(sketch)).toContain(vertical.id);

    const { sketch: settled, result } = solveSketch(sketch);
    expect(
      result.status === "solved" || result.status === "under-constrained",
    ).toBe(true);
    expect(listUnsatisfiedConstraints(settled)).toEqual([]);
    const left = lineOf(settled, rect.edges.left);
    expect(Math.abs(left.start.x - left.end.x)).toBeLessThan(
      TOLERANCE.coincidence,
    );
  });
});
