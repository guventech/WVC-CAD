import { distance, TOLERANCE } from "../geometry/GeometryMath.ts";
import type { ConstraintId } from "../model/Constraint.ts";
import type { Sketch } from "../model/Sketch.ts";
import { syncFilletArcAngles } from "../geometry/FilletTopology.ts";
import { buildJacobian } from "./Jacobian.ts";
import { solveNormalEquations, vecAdd, vecNormInf } from "./LinearAlgebra.ts";
import {
  residualRowWeights,
  scaleJacobianRows,
  scaleResidualRows,
} from "./ResidualScaling.ts";
import {
  buildResidualVector,
  createResidualContext,
  listUnsatisfiedConstraints,
  residualConstraintIds,
  residualValues,
} from "./Residuals.ts";
import type { SolverOptions, SolverStatus } from "./SolverResult.ts";
import {
  applyVariables,
  buildVariableSystem,
  type VariableSystem,
} from "./SolverVariables.ts";

export interface LmSolveResult {
  readonly sketch: Sketch;
  readonly status: SolverStatus;
  readonly iterations: number;
  readonly residual: number;
  readonly conflictingConstraints: readonly ConstraintId[];
  readonly warnings: readonly string[];
}

const DEFAULT_MAX_ITERATIONS = 50;
const INITIAL_LAMBDA = 1e-3;
const LAMBDA_UP = 10;
const LAMBDA_DOWN = 0.1;
const MAX_LAMBDA = 1e12;

/**
 * Levenberg–Marquardt least-squares solve of F(X) = 0 for free geometry
 * parameters. Anchored handles (drag) are excluded from X.
 */
export function solveLevenbergMarquardt(
  sketch: Sketch,
  options: SolverOptions = {},
): LmSolveResult {
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  // Numeric target for ||F||_∞; engineering acceptance still uses
  // listUnsatisfiedConstraints (coincidence / angular gates).
  const residualTolerance =
    options.residualTolerance ?? TOLERANCE.solverResidual;
  const anchors = options.anchors ?? [];

  const system = buildVariableSystem(sketch, anchors);
  const context = createResidualContext(sketch);
  let values = system.values.slice();
  let currentSketch = sketch;
  let equations = buildResidualVector(currentSketch, context);
  let residual = residualValues(equations);
  let residualNorm = vecNormInf(residual);

  if (
    residual.length === 0 ||
    (listUnsatisfiedConstraints(currentSketch).length === 0 &&
      geometryIsValid(currentSketch))
  ) {
    return {
      sketch: syncFilletArcAngles(currentSketch),
      status: "solved",
      iterations: 0,
      residual: residualNorm,
      conflictingConstraints: [],
      warnings: [],
    };
  }

  if (system.variables.length === 0) {
    return {
      sketch,
      status: "inconsistent",
      iterations: 0,
      residual: residualNorm,
      conflictingConstraints: uniqueHighResidualIds(equations, residualTolerance),
      warnings: ["No free parameters remain, but constraints are unsatisfied."],
    };
  }

  let lambda = INITIAL_LAMBDA;
  let iterations = 0;
  let bestSketch = sketch;
  let bestResidual = residualNorm;
  let bestEquations = equations;

  for (let iter = 1; iter <= maxIterations; iter += 1) {
    iterations = iter;
    const jacobian = buildJacobian(
      currentSketch,
      system,
      values,
      context,
      residual,
    );
    // ADR-052: row-weight mixed mm/radian residuals for the normal equations.
    // Column scaling is omitted — anisotropic λ damping broke H/V settles.
    // Engineering residual norms stay unscaled.
    const rowWeights = residualRowWeights(equations, currentSketch);
    const scaledResidual = scaleResidualRows(residual, rowWeights);
    const scaledJacobian = scaleJacobianRows(
      jacobian,
      residual.length,
      values.length,
      rowWeights,
    );
    const step = solveNormalEquations(
      residual.length,
      values.length,
      scaledJacobian,
      scaledResidual,
      lambda,
    );

    if (step === null) {
      lambda = Math.min(lambda * LAMBDA_UP, MAX_LAMBDA);
      if (lambda >= MAX_LAMBDA) {
        break;
      }
      continue;
    }

    const trialValues = vecAdd(values, step);
    const trialSketch = applyVariables(currentSketch, system, trialValues);
    const trialEquations = buildResidualVector(trialSketch, context);
    const trialResidual = residualValues(trialEquations);
    const trialNorm = vecNormInf(trialResidual);

    if (trialNorm < residualNorm) {
      values = trialValues;
      currentSketch = trialSketch;
      equations = trialEquations;
      residual = trialResidual;
      residualNorm = trialNorm;
      lambda = Math.max(lambda * LAMBDA_DOWN, 1e-16);
      if (trialNorm < bestResidual) {
        bestResidual = trialNorm;
        bestSketch = trialSketch;
        bestEquations = trialEquations;
      }
      // Prefer the numeric residual target; engineering gates are the fallback
      // acceptance check after the iteration budget is spent.
      if (residualNorm <= residualTolerance && geometryIsValid(currentSketch)) {
        return {
          sketch: currentSketch,
          status: "solved",
          iterations,
          residual: residualNorm,
          conflictingConstraints: [],
          warnings: [],
        };
      }
    } else {
      lambda = Math.min(lambda * LAMBDA_UP, MAX_LAMBDA);
      if (lambda >= MAX_LAMBDA) {
        break;
      }
    }
  }

  if (
    listUnsatisfiedConstraints(bestSketch).length === 0 &&
    geometryIsValid(bestSketch)
  ) {
    return {
      sketch: bestSketch,
      status: "solved",
      iterations,
      residual: bestResidual,
      conflictingConstraints: [],
      warnings: [],
    };
  }

  const conflicting = uniqueHighResidualIds(bestEquations, residualTolerance);
  const status = classifyFailure(
    system,
    bestEquations.length,
    bestResidual,
    residualTolerance,
  );

  return {
    sketch,
    status,
    iterations,
    residual: bestResidual,
    conflictingConstraints: conflicting,
    warnings:
      status === "failed"
        ? ["Solver did not converge within the iteration limit."]
        : ["Constraint system appears inconsistent."],
  };
}

function classifyFailure(
  system: VariableSystem,
  equationCount: number,
  residual: number,
  tolerance: number,
): SolverStatus {
  if (residual <= tolerance) {
    return "solved";
  }
  // More independent equations than free variables is a strong over-constraint signal.
  if (equationCount > system.variables.length) {
    return "inconsistent";
  }
  // Residual magnitude far above tolerance after LM → treat as inconsistent.
  if (residual > Math.max(tolerance * 1e3, 1e-3)) {
    return "inconsistent";
  }
  return "failed";
}

/** Reject zero-length lines / zero-radius circles that trivially "satisfy" H+V. */
function geometryIsValid(sketch: Sketch): boolean {
  for (const entity of sketch.geometry) {
    if (entity.type === "line") {
      if (distance(entity.start, entity.end) <= TOLERANCE.coincidence) {
        return false;
      }
    }
    if (
      (entity.type === "circle" || entity.type === "arc") &&
      !(entity.radius > TOLERANCE.coincidence)
    ) {
      return false;
    }
  }
  return true;
}

function uniqueHighResidualIds(
  equations: readonly { readonly constraintId: ConstraintId; readonly value: number }[],
  tolerance: number,
): ConstraintId[] {
  const ids: ConstraintId[] = [];
  const seen = new Set<ConstraintId>();
  for (const equation of equations) {
    if (Math.abs(equation.value) <= tolerance || seen.has(equation.constraintId)) {
      continue;
    }
    seen.add(equation.constraintId);
    ids.push(equation.constraintId);
  }
  // Prefer listing by max contribution when many are large.
  if (ids.length === 0 && equations.length > 0) {
    return residualConstraintIds(equations).filter(
      (id, index, all) => all.indexOf(id) === index,
    );
  }
  return ids;
}
