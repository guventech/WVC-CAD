import { describe, expect, it } from "vitest";
import { prepareAddConstraint } from "../commands/AddMaintainedConstraintCommand.ts";
import { addLineToSketch } from "../commands/CreateGeometryCommand.ts";
import { analyzeDegreesOfFreedom } from "../constraints/DegreesOfFreedom.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { createEmptySketch } from "../model/Sketch.ts";
import { solve } from "./Solver.ts";
import {
  characteristicLengthMm,
  residualKindForConstraintType,
  residualRowWeights,
  scaleJacobianRows,
  scaleResidualRows,
} from "./ResidualScaling.ts";
import { assembleSystem } from "./Jacobian.ts";

describe("ResidualScaling (ADR-052)", () => {
  it("classifies residual kinds", () => {
    expect(residualKindForConstraintType("length")).toBe("length");
    expect(residualKindForConstraintType("horizontal")).toBe("length");
    expect(residualKindForConstraintType("angle")).toBe("angle");
    expect(residualKindForConstraintType("parallel")).toBe("unitless");
  });

  it("uses positive row weights so rank/DOF stay honest on mixed systems", () => {
    resetEntityIdCounter();
    const a = addLineToSketch(createEmptySketch(), { x: 0, y: 0 }, { x: 40, y: 0 })!;
    let sketch = a.sketch;
    const b = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 20, y: 20 })!;
    sketch = b.sketch;
    const length = prepareAddConstraint(sketch, {
      type: "length",
      references: [{ entityId: a.line.id, role: "entity" }],
    });
    expect(length.ok).toBe(true);
    if (length.ok) {
      sketch = length.sketch;
    }
    const angle = prepareAddConstraint(sketch, {
      type: "angle",
      references: [
        { entityId: a.line.id, role: "entity" },
        { entityId: b.line.id, role: "entity" },
      ],
    });
    expect(angle.ok).toBe(true);
    if (angle.ok) {
      sketch = angle.sketch;
    }

    expect(characteristicLengthMm(sketch)).toBeGreaterThanOrEqual(1);
    const assembled = assembleSystem(sketch);
    const weights = residualRowWeights(
      assembled.constraintIds.map((constraintId, index) => ({
        constraintId,
        value: assembled.residual[index]!,
      })),
      sketch,
    );
    expect(weights.every((w) => w > 0 && Number.isFinite(w))).toBe(true);

    const scaled = scaleResidualRows(assembled.residual, weights);
    expect(scaled.length).toBe(assembled.residual.length);

    const analysis = analyzeDegreesOfFreedom(sketch);
    expect(analysis.degreesOfFreedom).toBeGreaterThan(0);
    expect(solve(sketch).status).toBe("under-constrained");
    expect(solve(sketch).degreesOfFreedom).toBe(analysis.degreesOfFreedom);
  });

  it("row scaling does not change matrix dimensions", () => {
    const jacobian = [1, 2, 3, 4, 5, 6];
    const scaled = scaleJacobianRows(jacobian, 2, 3, [2, 0.5]);
    expect(scaled).toEqual([2, 4, 6, 2, 2.5, 3]);
  });
});
