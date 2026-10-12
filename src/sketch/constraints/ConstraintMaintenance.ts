import type { Constraint, ConstraintId } from "../model/Constraint.ts";
import type { Sketch } from "../model/Sketch.ts";
import { stripChamferBlendCoincidents } from "../model/FilletChamferFeature.ts";
import {
  promoteFilletedRectangleEdgeLengths,
  restoreFilletedRectangleAxisCoordinates,
} from "../model/RectangleFillet.ts";
import { solveSketch } from "../solver/Solver.ts";
import {
  constraintResidual,
  listUnsatisfiedConstraints as listUnsatisfiedFromResiduals,
} from "../solver/Residuals.ts";
import type { PositionAnchor } from "./Coincident.ts";

export type { PositionAnchor } from "./Coincident.ts";

export interface MaintenanceResult {
  readonly sketch: Sketch;
  readonly satisfied: boolean;
  readonly iterations: number;
  readonly unsatisfiedConstraintIds: readonly ConstraintId[];
}

/**
 * Residual for constraints the solver enforces
 * (coincident, H/V, parallel/perp, tangent, concentric, midpoint, equal,
 * symmetric, point-on-object, Fix, Chunk 13 driving dimensions). Returns null for unsupported / reference dims.
 */
export function maintainedConstraintResidual(
  sketch: Sketch,
  constraint: Constraint,
): number | null {
  return constraintResidual(sketch, constraint);
}

export function listUnsatisfiedConstraints(sketch: Sketch): ConstraintId[] {
  return listUnsatisfiedFromResiduals(sketch);
}

/**
 * Enforce constraints via the Chunk 14 Levenberg–Marquardt solver (ADR-020).
 * `anchors` pin handles the user is dragging. Callers must treat
 * `satisfied === false` as a rejected edit and keep the previous sketch.
 */
export function maintainConstraints(
  sketch: Sketch,
  anchors: readonly PositionAnchor[] = [],
): MaintenanceResult {
  const before = listUnsatisfiedConstraints(sketch);
  if (before.length === 0 && anchors.length === 0) {
    return {
      sketch,
      satisfied: true,
      iterations: 0,
      unsatisfiedConstraintIds: [],
    };
  }

  const { sketch: next, result } = solveSketch(sketch, { anchors });
  const unsatisfied = listUnsatisfiedConstraints(next);
  // Residuals decide acceptance. Under-constrained (DOF > 0) is valid;
  // only over-constrained / inconsistent / failed edits are rejected.
  const satisfied =
    unsatisfied.length === 0 &&
    (result.status === "solved" || result.status === "under-constrained");

  return {
    sketch: satisfied ? next : sketch,
    satisfied,
    iterations: result.iterations ?? 0,
    unsatisfiedConstraintIds: satisfied
      ? []
      : unsatisfied.length > 0
        ? unsatisfied
        : [...result.conflictingConstraints],
  };
}

/**
 * After load/restore, settle residual violations. No-op when already satisfied.
 * On failure returns the original sketch unchanged.
 *
 * ADR-051: promotes filleted rectangle edge `length` → outer H/V spans, and
 * converts edge↔axis coincidents to coordinates. Does not invent missing
 * axis locate (broken saves stay documentary; recreate/fix the live path).
 */
export function settleLoadedSketch(sketch: Sketch): Sketch {
  const stripped = stripChamferBlendCoincidents(sketch);
  const promoted = promoteFilletedRectangleEdgeLengths(stripped);
  const located = restoreFilletedRectangleAxisCoordinates(promoted);
  return maintainConstraints(located).sketch;
}
