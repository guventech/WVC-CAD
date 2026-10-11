/**
 * TODO (ADR-052): residual/column scaling deferred.
 *
 * AGENTS §10 aspirational target is 1,000 constraints. Interactive sketches
 * stay comfortable in the tens–low hundreds. Full `solve()` / Jacobian-rank
 * DOF at this scale is O(n³) dense and is not a CI gate until scaling lands.
 *
 * This fixture locks a **residual-assembly** baseline so future work can
 * re-measure wall time against a known 1,000-constraint load.
 *
 * See docs/DECISIONS.md (ADR-052), Solver.ts, DegreesOfFreedom.ts.
 */
import { describe, expect, it } from "vitest";
import { addLineToSketch } from "../commands/CreateGeometryCommand.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import type { Constraint } from "../model/Constraint.ts";
import { createEmptySketch, type Sketch } from "../model/Sketch.ts";
import { assembleSystem } from "./Jacobian.ts";
import { vecNormInf } from "./LinearAlgebra.ts";

function createBench1000Constraints(): Sketch {
  resetEntityIdCounter();
  let sketch = createEmptySketch();
  const constraints: Constraint[] = [];
  let constraintSeq = 0;

  // Append records directly — do not call prepareAddConstraint (that maintains
  // / solves after every insert and would dominate the fixture build).
  for (let i = 0; i < 500; i += 1) {
    const created = addLineToSketch(
      sketch,
      { x: i * 12, y: 0 },
      { x: i * 12 + 10, y: 0 },
    )!;
    sketch = created.sketch;
    const lineId = created.line.id;
    constraints.push({
      id: `scale-h-${constraintSeq++}`,
      type: "horizontal",
      references: [{ entityId: lineId, role: "entity" }],
    });
    constraints.push({
      id: `scale-len-${constraintSeq++}`,
      type: "length",
      references: [{ entityId: lineId, role: "entity" }],
      value: 10,
      driving: true,
    });
  }

  return { ...sketch, constraints };
}

describe("solver scale baseline (1,000 constraints)", () => {
  it(
    "assembles residual for ~1,000 constraints within 15s",
    () => {
      const sketch = createBench1000Constraints();
      expect(sketch.constraints.length).toBeGreaterThanOrEqual(1000);

      const started = performance.now();
      const assembled = assembleSystem(sketch);
      const residual = vecNormInf(assembled.residual);
      const elapsed = performance.now() - started;

      console.log(
        `Assembled ${sketch.constraints.length} constraints ` +
          `(${assembled.system.variables.length} vars, ${assembled.residual.length} eqs) ` +
          `in ${elapsed.toFixed(1)}ms (‖F‖∞=${residual.toExponential(2)})`,
      );

      expect(assembled.system.variables.length).toBeGreaterThan(0);
      expect(assembled.residual.length).toBeGreaterThanOrEqual(1000);
      // Dense numerical Jacobian at 2k vars is well above interactive budget;
      // 15s locks a regression ceiling until ADR-052 scaling.
      expect(elapsed).toBeLessThan(15_000);
    },
    30_000,
  );

  // Full LM + Jacobian-rank diagnose at ~1k is outside the interactive budget
  // until ADR-052 residual/column scaling. Re-enable when that lands.
  it.skip("solveSketch 1,000-constraint settle (deferred until ADR-052 scaling)", () => {
    expect(true).toBe(true);
  });
});
