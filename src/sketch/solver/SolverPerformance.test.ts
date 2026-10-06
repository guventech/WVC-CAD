import { describe, expect, it } from "vitest";
import { addLineToSketch } from "../commands/CreateGeometryCommand.ts";
import { prepareAddConstraint } from "../commands/AddMaintainedConstraintCommand.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { createEmptySketch } from "../model/Sketch.ts";
import { solve, solveSketch } from "./Solver.ts";

/**
 * Dense JTJ + numerical Jacobian: practical interactive limit is far below
 * AGENTS §10's 1,000-constraint aspirational target. This baseline locks a
 * known-good mid-size sketch and records wall time for future regressions.
 */
describe("solver performance baseline", () => {
  it("diagnoses and settles a ~100-constraint sketch in under 5s", () => {
    resetEntityIdCounter();
    let sketch = createEmptySketch();
    const lineIds: string[] = [];

    for (let i = 0; i < 50; i += 1) {
      const created = addLineToSketch(
        sketch,
        { x: i * 12, y: 0 },
        { x: i * 12 + 10, y: i % 2 === 0 ? 0 : 2 },
      )!;
      sketch = created.sketch;
      lineIds.push(created.line.id);
    }

    for (const lineId of lineIds) {
      const horizontal = prepareAddConstraint(sketch, {
        type: "horizontal",
        references: [{ entityId: lineId, role: "entity" }],
      });
      if (horizontal.ok) {
        sketch = horizontal.sketch;
      }
      const length = prepareAddConstraint(sketch, {
        type: "length",
        references: [{ entityId: lineId, role: "entity" }],
        value: 10,
      });
      if (length.ok) {
        sketch = length.sketch;
      }
    }

    expect(sketch.constraints.length).toBeGreaterThanOrEqual(80);

    const diagnoseStarted = performance.now();
    const diagnosed = solve(sketch);
    const diagnoseMs = performance.now() - diagnoseStarted;
    expect(diagnosed.degreesOfFreedom).toBeGreaterThanOrEqual(0);
    expect(diagnoseMs).toBeLessThan(5000);

    const settleStarted = performance.now();
    const settled = solveSketch(sketch);
    const settleMs = performance.now() - settleStarted;
    expect(settled.result.status === "solved" || settled.result.status === "under-constrained").toBe(
      true,
    );
    expect(settleMs).toBeLessThan(5000);
  });
});
