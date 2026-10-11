import { describe, expect, it } from "vitest";
import { addLineToSketch } from "../commands/CreateGeometryCommand.ts";
import { prepareAddConstraint } from "../commands/AddMaintainedConstraintCommand.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { createEmptySketch } from "../model/Sketch.ts";
import { solve, solveSketch } from "./Solver.ts";

/**
 * Mid-size (~100 constraint) baseline: correctness is CI-gated; wall times are
 * logged with a generous sanity ceiling (GHA shared runners can exceed a
 * local 5s interactive target during fixture build + diagnose + settle).
 */
describe("solver performance baseline", () => {
  it(
    "diagnoses and settles a ~100-constraint sketch",
    () => {
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
      expect(
        diagnosed.status === "solved" ||
          diagnosed.status === "under-constrained" ||
          diagnosed.status === "over-constrained" ||
          diagnosed.status === "inconsistent" ||
          diagnosed.status === "failed",
      ).toBe(true);

      const settleStarted = performance.now();
      const settled = solveSketch(sketch);
      const settleMs = performance.now() - settleStarted;
      expect(
        settled.result.status === "solved" ||
          settled.result.status === "under-constrained",
      ).toBe(true);

      console.log(
        `~${sketch.constraints.length} constraints: diagnose ${diagnoseMs.toFixed(1)}ms, ` +
          `settle ${settleMs.toFixed(1)}ms (status=${settled.result.status})`,
      );

      // Sanity ceilings only — not the interactive <5s product target.
      expect(diagnoseMs).toBeLessThan(60_000);
      expect(settleMs).toBeLessThan(60_000);
    },
    90_000,
  );
});
