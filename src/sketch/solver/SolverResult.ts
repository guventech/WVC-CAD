import type { PositionAnchor } from "../constraints/Coincident.ts";
import type { ConstraintId } from "../model/Constraint.ts";

export type SolverStatus =
  | "solved"
  | "under-constrained"
  | "over-constrained"
  | "inconsistent"
  | "failed"
  | "not-implemented";

export interface SolverOptions {
  readonly anchors?: readonly PositionAnchor[];
  readonly maxIterations?: number;
  readonly residualTolerance?: number;
}

export interface SolverResult {
  readonly status: SolverStatus;
  readonly iterations: number | null;
  readonly residual: number | null;
  readonly degreesOfFreedom: number | null;
  readonly conflictingConstraints: readonly ConstraintId[];
  readonly warnings: readonly string[];
}

export function createSolverResult(partial: {
  readonly status: SolverStatus;
  readonly iterations: number | null;
  readonly residual: number | null;
  readonly conflictingConstraints: readonly ConstraintId[];
  readonly degreesOfFreedom?: number | null;
  readonly warnings?: readonly string[];
}): SolverResult {
  return {
    status: partial.status,
    iterations: partial.iterations,
    residual: partial.residual,
    degreesOfFreedom: partial.degreesOfFreedom ?? null,
    conflictingConstraints: partial.conflictingConstraints,
    warnings: partial.warnings ?? [],
  };
}
