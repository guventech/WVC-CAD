/**
 * ADR-052 residual row scaling is active in LM + rank paths.
 *
 * AGENTS §10 aspirational target is 1,000 constraints. Interactive sketches
 * stay comfortable in the tens–low hundreds. Full Jacobian-rank DOF at this
 * scale remains O(n³) dense.
 *
 * Correctness is CI-gated; wall time is logged with a generous sanity ceiling
 * only (Ubuntu GHA observed ~25s for assembly — do not use a local 15s gate).
 *
 * See docs/DECISIONS.md (ADR-052), ResidualScaling.ts.
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
    "assembles a finite residual system for ~1,000 constraints",
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
      expect(Number.isFinite(residual)).toBe(true);
      // Sanity only — not an interactive-budget gate (CI ~25s observed).
      expect(elapsed).toBeLessThan(90_000);
    },
    120_000,
  );

  // Full LM + Jacobian-rank diagnose at ~1k remains outside the interactive
  // budget even with ADR-052 scaling (dense O(n³)). Keep skipped as aspirational.
  it.skip("solveSketch 1,000-constraint settle (aspirational; dense O(n³))", () => {
    expect(true).toBe(true);
  });
});
