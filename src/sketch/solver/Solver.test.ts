import { beforeEach, describe, expect, it } from "vitest";
import { prepareAddConstraint } from "../commands/AddMaintainedConstraintCommand.ts";
import {
  addCircleToSketch,
  addLineToSketch,
  addPointToSketch,
} from "../commands/CreateGeometryCommand.ts";
import { createAddRectangleCommand } from "../commands/CreateRectangleCommand.ts";
import { createEditDimensionCommand } from "../commands/EditDimensionCommand.ts";
import { applyGeometryDragWithConstraints } from "../commands/GeometryEdit.ts";
import { TOLERANCE } from "../geometry/GeometryMath.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import {
  parseRectangleFeature,
  readRectangleCorners,
} from "../model/RectangleFeature.ts";
import { createEmptySketch, type Sketch } from "../model/Sketch.ts";
import { assembleSystem } from "./Jacobian.ts";
import { matVec, solveCholesky, vecNormInf } from "./LinearAlgebra.ts";
import { listUnsatisfiedConstraints } from "./Residuals.ts";
import { solve, solveSketch } from "./Solver.ts";

function mustAdd(
  sketch: Sketch,
  request: Parameters<typeof prepareAddConstraint>[1],
): Sketch {
  const outcome = prepareAddConstraint(sketch, request);
  if (!outcome.ok) {
    throw new Error(outcome.reason);
  }
  return outcome.sketch;
}

function mustEdit(sketch: Sketch, constraintId: string, value: number): Sketch {
  const outcome = createEditDimensionCommand(sketch, constraintId, { value });
  if (!outcome.ok) {
    throw new Error(outcome.reason);
  }
  return outcome.command.apply(sketch);
}

describe("linear algebra", () => {
  it("solves a small SPD system with Cholesky", () => {
    const x = solveCholesky(2, [4, 1, 1, 3], [1, 2]);
    expect(x).not.toBeNull();
    expect(x![0]).toBeCloseTo(1 / 11, 10);
    expect(x![1]).toBeCloseTo(7 / 11, 10);
  });
});

describe("solveSketch / LM (Chunk 14)", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("makes a slanted line horizontal by solving F(X)=0", () => {
    const created = addLineToSketch(createEmptySketch(), { x: 0, y: 0 }, { x: 40, y: 10 })!;
    const sketch = mustAdd(created.sketch, {
      type: "horizontal",
      references: [{ entityId: created.line.id, role: "entity" }],
    });
    const line = sketch.geometry.find((entity) => entity.id === created.line.id);
    expect(line?.type).toBe("line");
    if (line?.type === "line") {
      expect(Math.abs(line.start.y - line.end.y)).toBeLessThan(TOLERANCE.coincidence);
    }
    expect(listUnsatisfiedConstraints(sketch)).toEqual([]);
    expect(solve(sketch).status).toBe("under-constrained");
    expect(solve(sketch).degreesOfFreedom).toBe(3);
  });

  it("drives a length dimension deterministically", () => {
    const created = addLineToSketch(createEmptySketch(), { x: 0, y: 0 }, { x: 50, y: 0 })!;
    const constrained = mustAdd(created.sketch, {
      type: "length",
      references: [{ entityId: created.line.id, role: "entity" }],
    });
    const id = constrained.constraints[0]!.id;
    const a = mustEdit(constrained, id, 80);
    const b = mustEdit(constrained, id, 80);
    expect(a.geometry).toEqual(b.geometry);
    const line = a.geometry.find((entity) => entity.id === created.line.id);
    expect(line?.type).toBe("line");
    if (line?.type === "line") {
      expect(
        Math.hypot(line.end.x - line.start.x, line.end.y - line.start.y),
      ).toBeCloseTo(80, 5);
    }
  });

  it("keeps a horizontal line horizontal while dragging an endpoint", () => {
    const created = addLineToSketch(createEmptySketch(), { x: 0, y: 0 }, { x: 40, y: 0 })!;
    const constrained = mustAdd(created.sketch, {
      type: "horizontal",
      references: [{ entityId: created.line.id, role: "entity" }],
    });
    const moved = applyGeometryDragWithConstraints(
      constrained,
      { kind: "line-endpoint", entityId: created.line.id, which: "end" },
      { x: 55, y: 17 },
    );
    const line = moved.geometry.find((entity) => entity.id === created.line.id);
    expect(line?.type).toBe("line");
    if (line?.type === "line") {
      expect(line.end).toEqual({ x: 55, y: 17 });
      expect(line.start.y).toBeCloseTo(17, 6);
    }
    expect(listUnsatisfiedConstraints(moved)).toEqual([]);
  });

  it("marks an H+V line as inconsistent and does not apply a partial solve", () => {
    const created = addLineToSketch(createEmptySketch(), { x: 0, y: 0 }, { x: 40, y: 0 })!;
    const horizontal = mustAdd(created.sketch, {
      type: "horizontal",
      references: [{ entityId: created.line.id, role: "entity" }],
    });
    expect(
      prepareAddConstraint(horizontal, {
        type: "vertical",
        references: [{ entityId: created.line.id, role: "entity" }],
      }).ok,
    ).toBe(false);

    const overconstrained = {
      ...horizontal,
      constraints: [
        ...horizontal.constraints,
        {
          id: "bad-v",
          type: "vertical" as const,
          references: [{ entityId: created.line.id, role: "entity" as const }],
        },
      ],
    };
    const dry = solveSketch(overconstrained);
    expect(["inconsistent", "failed"]).toContain(dry.result.status);
    expect(dry.sketch.geometry).toEqual(overconstrained.geometry);
    expect(dry.result.conflictingConstraints.length).toBeGreaterThan(0);
  });

  it("solves a 100×50 rectangle (Fixture C geometry) without claiming DOF", () => {
    let sketch = createAddRectangleCommand({ x: 0, y: 0 }, { x: 40, y: 20 })!.apply(
      createEmptySketch(),
    );
    const feature = sketch.constraints
      .map(parseRectangleFeature)
      .find((item) => item !== null)!;

    sketch = mustAdd(sketch, {
      type: "length",
      references: [{ entityId: feature.edges.bottom, role: "entity" }],
    });
    const widthId = sketch.constraints.find((c) => c.type === "length")!.id;
    sketch = mustEdit(sketch, widthId, 100);

    sketch = mustAdd(sketch, {
      type: "length",
      references: [{ entityId: feature.edges.left, role: "entity" }],
    });
    const heightId = sketch.constraints.filter((c) => c.type === "length").at(-1)!.id;
    sketch = mustEdit(sketch, heightId, 50);

    const corners = readRectangleCorners(sketch.geometry, feature)!;
    expect(corners.br.x - corners.bl.x).toBeCloseTo(100, 5);
    expect(corners.tl.y - corners.bl.y).toBeCloseTo(50, 5);
    const diagnosis = solve(sketch);
    // Width + height leave rigid-body / position DOF (no Fix / coordinates yet here).
    expect(diagnosis.status).toBe("under-constrained");
    expect(diagnosis.degreesOfFreedom).toBeGreaterThan(0);
  });

  it("assembles a Jacobian of the expected shape", () => {
    const created = addLineToSketch(createEmptySketch(), { x: 0, y: 0 }, { x: 30, y: 10 })!;
    const sketch = {
      ...created.sketch,
      constraints: [
        {
          id: "h1",
          type: "horizontal" as const,
          references: [{ entityId: created.line.id, role: "entity" as const }],
        },
      ],
    };
    const assembled = assembleSystem(sketch);
    expect(assembled.residual.length).toBe(1);
    expect(assembled.jacobian.length).toBe(assembled.system.variables.length);
    const zero = matVec(
      assembled.residual.length,
      assembled.system.variables.length,
      assembled.jacobian,
      assembled.system.values.map(() => 0),
    );
    expect(vecNormInf(zero)).toBe(0);
  });

  it("solves a radius constraint on a circle", () => {
    const created = addCircleToSketch(createEmptySketch(), { x: 0, y: 0 }, 10)!;
    const added = mustAdd(created.sketch, {
      type: "radius",
      references: [{ entityId: created.circle.id, role: "entity" }],
    });
    const sketch = mustEdit(added, added.constraints[0]!.id, 25);
    const circle = sketch.geometry.find((entity) => entity.id === created.circle.id);
    expect(circle?.type === "circle" && circle.radius).toBeCloseTo(25, 5);
    // Center remains free → under-constrained (2 DOF).
    expect(solve(sketch).status).toBe("under-constrained");
    expect(solve(sketch).degreesOfFreedom).toBe(2);
  });

  it("treats free geometry as under-constrained with residual 0", () => {
    let sketch = createEmptySketch();
    sketch = addPointToSketch(sketch, { x: 1, y: 2 }).sketch;
    sketch = addPointToSketch(sketch, { x: 3, y: 4 }).sketch;
    const result = solve(sketch);
    expect(result.status).toBe("under-constrained");
    expect(result.degreesOfFreedom).toBe(4);
    expect(result.residual).toBe(0);
  });
});
