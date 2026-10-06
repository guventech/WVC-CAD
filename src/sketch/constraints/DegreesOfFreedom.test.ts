import { beforeEach, describe, expect, it } from "vitest";
import { addCoincidentToSketch } from "../commands/AddCoincidentCommand.ts";
import { prepareAddConstraint } from "../commands/AddMaintainedConstraintCommand.ts";
import {
  addCircleToSketch,
  addLineToSketch,
  addPointToSketch,
} from "../commands/CreateGeometryCommand.ts";
import { createAddRectangleCommand } from "../commands/CreateRectangleCommand.ts";
import { createEditDimensionCommand } from "../commands/EditDimensionCommand.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { parseRectangleFeature } from "../model/RectangleFeature.ts";
import { DATUM_ORIGIN_ID } from "../model/SketchFrame.ts";
import { createEmptySketch, type Sketch } from "../model/Sketch.ts";
import { solve } from "../solver/Solver.ts";
import {
  analyzeDegreesOfFreedom,
  formatConstraintStatus,
} from "./DegreesOfFreedom.ts";

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

describe("degrees of freedom (Chunk 15)", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("Fixture A — free line has 4 DOF", () => {
    const created = addLineToSketch(createEmptySketch(), { x: 0, y: 0 }, { x: 40, y: 10 })!;
    const analysis = analyzeDegreesOfFreedom(created.sketch);
    expect(analysis.variableCount).toBe(4);
    expect(analysis.equationCount).toBe(0);
    expect(analysis.degreesOfFreedom).toBe(4);

    const result = solve(created.sketch);
    expect(result.status).toBe("under-constrained");
    expect(result.degreesOfFreedom).toBe(4);
    expect(formatConstraintStatus(result)).toBe("UNDER-CONSTRAINED — 4 DOF");
  });

  it("Fixture B — horizontal line has 3 DOF", () => {
    const created = addLineToSketch(createEmptySketch(), { x: 0, y: 0 }, { x: 40, y: 8 })!;
    const sketch = mustAdd(created.sketch, {
      type: "horizontal",
      references: [{ entityId: created.line.id, role: "entity" }],
    });
    const analysis = analyzeDegreesOfFreedom(sketch);
    expect(analysis.degreesOfFreedom).toBe(3);
    const result = solve(sketch);
    expect(result.status).toBe("under-constrained");
    expect(result.degreesOfFreedom).toBe(3);
  });

  it("free point has 2 DOF", () => {
    const added = addPointToSketch(createEmptySketch(), { x: 3, y: 4 });
    const result = solve(added.sketch);
    expect(result.status).toBe("under-constrained");
    expect(result.degreesOfFreedom).toBe(2);
  });

  it("Fixture D — circle R=20 with center coincident to origin is fully constrained", () => {
    const created = addCircleToSketch(createEmptySketch(), { x: 5, y: 5 }, 10)!;
    let sketch = addCoincidentToSketch(
      created.sketch,
      { entityId: created.circle.id, role: "center" },
      { entityId: DATUM_ORIGIN_ID, role: "position" },
    )!;
    sketch = mustAdd(sketch, {
      type: "radius",
      references: [{ entityId: created.circle.id, role: "entity" }],
    });
    sketch = mustEdit(sketch, sketch.constraints.find((c) => c.type === "radius")!.id, 20);

    const result = solve(sketch);
    expect(result.degreesOfFreedom).toBe(0);
    expect(result.status).toBe("solved");
    expect(formatConstraintStatus(result)).toBe("FULLY CONSTRAINED");
  });

  it("Fixture C — 100×50 rectangle with corner coincident to origin is fully constrained", () => {
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

    const analysis = analyzeDegreesOfFreedom(sketch);
    expect(analysis.degreesOfFreedom).toBe(0);
    const result = solve(sketch);
    expect(result.status).toBe("solved");
    expect(result.degreesOfFreedom).toBe(0);
    expect(formatConstraintStatus(result)).toBe("FULLY CONSTRAINED");
  });

  it("empty sketch reports NO GEOMETRY / 0 DOF", () => {
    const result = solve(createEmptySketch());
    expect(result.degreesOfFreedom).toBe(0);
    expect(result.status).toBe("solved");
    expect(
      formatConstraintStatus(result, { geometryCount: 0 }),
    ).toBe("NO GEOMETRY");
  });

  it("does not invent DOF from dimension count alone", () => {
    // A reference (non-driving) length must not reduce DOF.
    const created = addLineToSketch(createEmptySketch(), { x: 0, y: 0 }, { x: 50, y: 0 })!;
    const sketch = mustAdd(created.sketch, {
      type: "length",
      references: [{ entityId: created.line.id, role: "entity" }],
      driving: false,
    });
    expect(sketch.constraints).toHaveLength(1);
    expect(analyzeDegreesOfFreedom(sketch).degreesOfFreedom).toBe(4);
    expect(solve(sketch).status).toBe("under-constrained");
  });

  it("mixed length + angle residuals classify DOF without inventing full constraint", () => {
    const a = addLineToSketch(createEmptySketch(), { x: 0, y: 0 }, { x: 40, y: 0 })!;
    let sketch = a.sketch;
    const b = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 20, y: 20 })!;
    sketch = b.sketch;
    sketch = mustAdd(sketch, {
      type: "length",
      references: [{ entityId: a.line.id, role: "entity" }],
    });
    sketch = mustAdd(sketch, {
      type: "angle",
      references: [
        { entityId: a.line.id, role: "entity" },
        { entityId: b.line.id, role: "entity" },
      ],
    });

    const analysis = analyzeDegreesOfFreedom(sketch);
    expect(analysis.variableCount).toBeGreaterThan(0);
    expect(analysis.equationCount).toBeGreaterThanOrEqual(2);
    // Two free lines (8 vars) with length + angle remain under-constrained.
    expect(analysis.degreesOfFreedom).toBeGreaterThan(0);
    const result = solve(sketch);
    expect(result.status).toBe("under-constrained");
    expect(result.degreesOfFreedom).toBe(analysis.degreesOfFreedom);
  });
});

