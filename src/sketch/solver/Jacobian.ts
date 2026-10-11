import type { PositionAnchor } from "../constraints/Coincident.ts";
import type { Sketch } from "../model/Sketch.ts";
import {
  buildResidualVector,
  createResidualContext,
  residualValues,
  type ResidualContext,
} from "./Residuals.ts";
import {
  applyVariables,
  buildVariableSystem,
  type VariableSystem,
} from "./SolverVariables.ts";

/**
 * Numerical Jacobian ∂F/∂X via central differences (±step).
 * Absolute floor avoids zero-scale stalls. Central differences give O(step²)
 * truncation error, better matched to solverResidual (1e-8) than one-sided FD.
 *
 * Residuals mix mm and radians unscaled (ADR-052). Do not add ad-hoc column
 * scaling here without updating DOF fixtures and documenting the change.
 */
const FD_RELATIVE = 1e-7;
const FD_ABSOLUTE = 1e-8;

/**
 * Numerical Jacobian ∂F/∂X via central differences.
 * Layout: row-major, equation-major (nResiduals × nVariables).
 */
export function buildJacobian(
  sketch: Sketch,
  system: VariableSystem,
  values: readonly number[],
  context: ResidualContext,
  baseResidual: readonly number[],
): number[] {
  const nR = baseResidual.length;
  const nV = values.length;
  const jacobian = new Array<number>(nR * nV).fill(0);

  for (let j = 0; j < nV; j += 1) {
    const step = Math.max(FD_ABSOLUTE, FD_RELATIVE * Math.abs(values[j]!));
    const plus = values.slice();
    const minus = values.slice();
    plus[j]! += step;
    minus[j]! -= step;
    const plusResidual = residualValues(
      buildResidualVector(applyVariables(sketch, system, plus), context),
    );
    const minusResidual = residualValues(
      buildResidualVector(applyVariables(sketch, system, minus), context),
    );
    const denom = 2 * step;
    for (let i = 0; i < nR; i += 1) {
      jacobian[i * nV + j] = (plusResidual[i]! - minusResidual[i]!) / denom;
    }
  }

  return jacobian;
}

/** Convenience: assemble variables + residuals + Jacobian for a sketch. */
export function assembleSystem(
  sketch: Sketch,
  anchors: readonly PositionAnchor[] = [],
): {
  readonly system: VariableSystem;
  readonly context: ResidualContext;
  readonly residual: number[];
  readonly jacobian: number[];
  readonly constraintIds: readonly string[];
} {
  const system = buildVariableSystem(sketch, anchors);
  const context = createResidualContext(sketch);
  const equations = buildResidualVector(sketch, context);
  const residual = residualValues(equations);
  const jacobian = buildJacobian(sketch, system, system.values, context, residual);
  return {
    system,
    context,
    residual,
    jacobian,
    constraintIds: equations.map((equation) => equation.constraintId),
  };
}
