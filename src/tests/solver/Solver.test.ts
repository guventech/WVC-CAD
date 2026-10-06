import { beforeEach, describe, expect, it } from "vitest";
import { prepareAddConstraint } from "../../sketch/commands/AddMaintainedConstraintCommand.ts";
import { addLineToSketch } from "../../sketch/commands/CreateGeometryCommand.ts";
import { formatConstraintStatus } from "../../sketch/constraints/DegreesOfFreedom.ts";
import { TOLERANCE } from "../../sketch/geometry/GeometryMath.ts";
import { resetEntityIdCounter } from "../../sketch/model/EntityId.ts";
import { createEmptySketch } from "../../sketch/model/Sketch.ts";
import { solve } from "../../sketch/solver/Solver.ts";

describe("solve", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("reports NO GEOMETRY / 0 DOF on an empty sketch without mutating it", () => {
    const sketch = createEmptySketch({ id: "s1", name: "Part" });
    const before = structuredClone(sketch);

    const result = solve(sketch);

    expect(sketch).toEqual(before);
    expect(result.status).toBe("solved");
    expect(result.iterations).toBe(0);
    expect(result.residual).toBe(0);
    expect(result.degreesOfFreedom).toBe(0);
    expect(result.conflictingConstraints).toEqual([]);
    expect(formatConstraintStatus(result, { geometryCount: 0 })).toBe("NO GEOMETRY");
  });

  it("reports under-constrained with 3 DOF after a horizontal constraint", () => {
    const created = addLineToSketch(createEmptySketch(), { x: 0, y: 0 }, { x: 20, y: 5 })!;
    const outcome = prepareAddConstraint(created.sketch, {
      type: "horizontal",
      references: [{ entityId: created.line.id, role: "entity" }],
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }
    const result = solve(outcome.sketch);
    expect(result.status).toBe("under-constrained");
    expect(result.degreesOfFreedom).toBe(3);
    expect(result.residual ?? 1).toBeLessThanOrEqual(TOLERANCE.coincidence);
    expect(formatConstraintStatus(result)).toBe("UNDER-CONSTRAINED — 3 DOF");
  });
});
