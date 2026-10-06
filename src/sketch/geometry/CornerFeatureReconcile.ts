import {
  listUnsatisfiedConstraints,
  maintainConstraints,
} from "../constraints/ConstraintMaintenance.ts";
import type { Sketch } from "../model/Sketch.ts";
import {
  cornerFeaturesTopologyIntact,
  rebuildAllCornerFeatures,
} from "./FilletChamferOpsShared.ts";
import { restoreUnsatisfiedFilletedLengths } from "./FilletLengthRestore.ts";

export {
  findChamferAngleConstraint,
  rebuildChamferGeometry,
  rebuildCornerFeaturesTouching,
  rebuildAllCornerFeatures,
  cornerFeaturesTopologyIntact,
  translateCornerFeaturesTouching,
} from "./FilletChamferOpsShared.ts";

/**
 * Geometry re-seating after LM (not a second constraint solver).
 *
 * Fillet/chamfer arcs have derived start/end angles that are not free solver
 * variables. After `maintainConstraints` moves parent lines, this step:
 * 1. Rebuilds blend geometry from current parents (`rebuildAllCornerFeatures`)
 * 2. Restores driving lengths on filleted edges that the rebuild temporarily broke
 * 3. Re-runs LM via `maintainConstraints` so residual satisfaction remains authoritative
 *
 * Invariant: a non-null return always has zero unsatisfied supported constraints
 * (same engineering gates as LM). Returning null means topology or constraints
 * could not settle — callers must reject the edit and keep the previous sketch.
 * This step must not accept a sketch that LM already rejected.
 */
export function reconcileCornerFeaturesAfterSolve(sketch: Sketch): Sketch | null {
  let next = rebuildAllCornerFeatures(sketch);
  next = restoreUnsatisfiedFilletedLengths(next);
  const finalized = maintainConstraints(next, []);
  if (!finalized.satisfied) {
    return null;
  }
  next = rebuildAllCornerFeatures(finalized.sketch);
  if (listUnsatisfiedConstraints(next).length > 0) {
    next = restoreUnsatisfiedFilletedLengths(next);
    const again = maintainConstraints(next, []);
    if (!again.satisfied) {
      return null;
    }
    next = rebuildAllCornerFeatures(again.sketch);
  }
  // Satisfaction invariant: never return a sketch with failing gates.
  if (listUnsatisfiedConstraints(next).length > 0) {
    return null;
  }
  if (!cornerFeaturesTopologyIntact(next)) {
    return null;
  }
  return next;
}
