import {
  analyzeDegreesOfFreedom,
  classifySketchStatus,
} from "../constraints/DegreesOfFreedom.ts";
import { TOLERANCE } from "../geometry/GeometryMath.ts";
import type { Sketch } from "../model/Sketch.ts";
import { solveLevenbergMarquardt } from "./LevenbergMarquardt.ts";
import {
  listUnsatisfiedConstraints,
  maxSupportedResidual,
} from "./Residuals.ts";
import {
  createSolverResult,
  type SolverOptions,
  type SolverResult,
} from "./SolverResult.ts";

export type { SolverOptions, SolverResult } from "./SolverResult.ts";

export interface SolveApplyResult {
  readonly sketch: Sketch;
  readonly result: SolverResult;
}

/**
 * Diagnose the current sketch without mutating it.
 * Status and DOF come from residual satisfaction + Jacobian rank (Chunk 15)
 * on the **stored** geometry — this does not run LM.
 *
 * Interactive edits go through `solveSketch` / `maintainConstraints`, which
 * settle geometry first. After load (or external edits), call `solve` for a
 * non-mutating report of the stored state, or `solveSketch` if you need to
 * settle residuals before trusting status.
 */
export function solve(sketch: Sketch, options?: SolverOptions): SolverResult {
  void options;
  return diagnoseSketch(sketch, 0);
}

/**
 * Run Levenberg–Marquardt and return updated geometry when F(X) ≈ 0.
 * On failure the original sketch is returned (no partial apply).
 */
export function solveSketch(
  sketch: Sketch,
  options: SolverOptions = {},
): SolveApplyResult {
  const lm = solveLevenbergMarquardt(sketch, options);

  if (lm.status !== "solved") {
    const dof = analyzeDegreesOfFreedom(sketch);
    return {
      sketch,
      result: createSolverResult({
        status: classifySketchStatus(sketch, {
          residualSatisfied: false,
          dof,
        }),
        iterations: lm.iterations,
        residual: lm.residual,
        degreesOfFreedom: dof.degreesOfFreedom,
        conflictingConstraints: lm.conflictingConstraints,
        warnings: lm.warnings,
      }),
    };
  }

  const unsatisfied = listUnsatisfiedConstraints(lm.sketch);
  if (unsatisfied.length > 0) {
    const dof = analyzeDegreesOfFreedom(sketch);
    return {
      sketch,
      result: createSolverResult({
        status: "failed",
        iterations: lm.iterations,
        residual: Math.max(lm.residual, maxSupportedResidual(lm.sketch)),
        degreesOfFreedom: dof.degreesOfFreedom,
        conflictingConstraints: unsatisfied,
        warnings: [
          "Solver residual met the numeric tolerance but constraint gates still fail.",
        ],
      }),
    };
  }

  return {
    sketch: lm.sketch,
    result: diagnoseSketch(lm.sketch, lm.iterations),
  };
}

/** True when every maintained constraint is within its engineering tolerance. */
export function isSketchSatisfied(sketch: Sketch): boolean {
  return listUnsatisfiedConstraints(sketch).length === 0;
}

export const SOLVER_DEFAULT_TOLERANCE = TOLERANCE.solverResidual;

function diagnoseSketch(sketch: Sketch, iterations: number): SolverResult {
  const residual = maxSupportedResidual(sketch);
  const unsatisfied = listUnsatisfiedConstraints(sketch);
  const dof = analyzeDegreesOfFreedom(sketch);
  const status = classifySketchStatus(sketch, {
    residualSatisfied: unsatisfied.length === 0,
    dof,
  });

  const warnings: string[] = [];
  if (unsatisfied.length === 0 && dof.redundantEquations > 0 && dof.degreesOfFreedom === 0) {
    warnings.push(
      `Sketch is fully constrained with ${dof.redundantEquations} redundant equation(s).`,
    );
  }

  return createSolverResult({
    status,
    iterations,
    residual,
    degreesOfFreedom: dof.degreesOfFreedom,
    conflictingConstraints: unsatisfied,
    warnings,
  });
}
