/**
 * ADR-052: rank uses row-scaled Jacobian from `assembleSystem` (positive
 * weights ⇒ same nullspace dimension). Do not invent DOF from dimension
 * counts or closed-profile status. See ResidualScaling.ts / DECISIONS.md.
 */
import { TOLERANCE } from "../geometry/GeometryMath.ts";
import type { Sketch } from "../model/Sketch.ts";
import { assembleSystem } from "../solver/Jacobian.ts";
import { matrixRank, vecNormInf } from "../solver/LinearAlgebra.ts";
import type { SolverResult, SolverStatus } from "../solver/SolverResult.ts";

export interface DofAnalysis {
  readonly variableCount: number;
  readonly equationCount: number;
  readonly rank: number;
  /** max(0, variables − rank(J)). */
  readonly degreesOfFreedom: number;
  /** max(0, equations − rank); consistent redundancy when residual is small. */
  readonly redundantEquations: number;
}

/**
 * DOF from Jacobian rank of the current residual system — not from counting
 * dimensions. Empty geometry → 0 DOF.
 */
export function analyzeDegreesOfFreedom(sketch: Sketch): DofAnalysis {
  if (sketch.geometry.length === 0) {
    return {
      variableCount: 0,
      equationCount: 0,
      rank: 0,
      degreesOfFreedom: 0,
      redundantEquations: 0,
    };
  }

  const assembled = assembleSystem(sketch);
  const variableCount = assembled.system.variables.length;
  const equationCount = assembled.residual.length;

  if (variableCount === 0) {
    return {
      variableCount: 0,
      equationCount,
      rank: 0,
      degreesOfFreedom: 0,
      redundantEquations: equationCount,
    };
  }

  if (equationCount === 0) {
    return {
      variableCount,
      equationCount: 0,
      rank: 0,
      degreesOfFreedom: variableCount,
      redundantEquations: 0,
    };
  }

  const scale = Math.max(1, vecNormInf(assembled.jacobian));
  const rank = matrixRank(
    equationCount,
    variableCount,
    assembled.jacobian,
    TOLERANCE.solverResidual * scale,
  );

  return {
    variableCount,
    equationCount,
    rank,
    degreesOfFreedom: Math.max(0, variableCount - rank),
    redundantEquations: Math.max(0, equationCount - rank),
  };
}

/**
 * Map residual satisfaction + Jacobian DOF onto SolverStatus.
 * Does not mutate the sketch.
 */
export function classifySketchStatus(
  sketch: Sketch,
  options: {
    readonly residualSatisfied: boolean;
    readonly dof: DofAnalysis;
  },
): SolverStatus {
  if (!options.residualSatisfied) {
    if (
      options.dof.variableCount === 0 ||
      options.dof.equationCount > options.dof.variableCount ||
      (options.dof.rank >= options.dof.variableCount && options.dof.variableCount > 0)
    ) {
      return "over-constrained";
    }
    return "inconsistent";
  }

  if (sketch.geometry.length === 0) {
    return "solved";
  }

  if (options.dof.degreesOfFreedom > 0) {
    return "under-constrained";
  }

  return "solved";
}

/** Human-readable constraint status for status bar / panel (text, not color-only). */
export function formatConstraintStatus(
  result: SolverResult,
  options?: { readonly geometryCount?: number },
): string {
  const dof = result.degreesOfFreedom;
  if ((options?.geometryCount ?? 1) === 0) {
    return "NO GEOMETRY";
  }
  switch (result.status) {
    case "under-constrained":
      return dof === null ? "UNDER-CONSTRAINED" : `UNDER-CONSTRAINED — ${dof} DOF`;
    case "solved":
      return "FULLY CONSTRAINED";
    case "over-constrained":
      return "OVER-CONSTRAINED";
    case "inconsistent":
      return "INCONSISTENT";
    case "failed":
      return "SOLVER FAILED";
    case "not-implemented":
      return "SOLVER NOT IMPLEMENTED";
  }
}

export function constraintStatusTone(
  status: SolverStatus,
): "ok" | "warn" | "error" | "neutral" {
  switch (status) {
    case "solved":
      return "ok";
    case "under-constrained":
      return "warn";
    case "over-constrained":
    case "inconsistent":
    case "failed":
      return "error";
    case "not-implemented":
      return "neutral";
  }
}
