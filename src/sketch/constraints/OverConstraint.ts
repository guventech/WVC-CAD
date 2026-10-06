import { getConstraintTypeInfo } from "./ConstraintTypes.ts";
import type { Constraint, ConstraintId } from "../model/Constraint.ts";
import type { Sketch } from "../model/Sketch.ts";
import { solveSketch } from "../solver/Solver.ts";
import { listUnsatisfiedConstraints } from "../solver/Residuals.ts";

/**
 * Structured conflict report when a proposed constraint/edit cannot be applied.
 * The sketch is never mutated by diagnosis — callers keep the previous valid model.
 */
export interface ConstraintConflict {
  readonly reason: string;
  /** Existing (+ proposed) constraint ids implicated in the failure. */
  readonly conflictingConstraintIds: readonly ConstraintId[];
  readonly proposedConstraintId: ConstraintId | null;
}

/**
 * Diagnose why inserting `proposed` into `base` fails.
 * Runs a dry solve on a temporary sketch; never returns a mutated base.
 */
export function diagnoseAddConstraintConflict(
  base: Sketch,
  proposed: Constraint,
): ConstraintConflict {
  const temporary: Sketch = {
    ...base,
    constraints: [...base.constraints, proposed],
  };
  const { result } = solveSketch(temporary);
  // Residuals on the temporary sketch even when solveSketch refused to apply.
  const residualIds = listUnsatisfiedConstraints(temporary);
  const ids = uniqueIds([
    proposed.id,
    ...residualIds,
    ...result.conflictingConstraints,
    ...relatedExistingConflicts(base, proposed, residualIds),
  ]);

  return {
    proposedConstraintId: proposed.id,
    conflictingConstraintIds: ids,
    reason: formatAddConflictReason(base, proposed, ids),
  };
}

/**
 * Diagnose a failed dimension edit (value already replaced in `attempted`).
 */
export function diagnoseEditConstraintConflict(
  base: Sketch,
  attempted: Sketch,
  editedId: ConstraintId,
): ConstraintConflict {
  const { result } = solveSketch(attempted);
  const residualIds = listUnsatisfiedConstraints(attempted);
  const ids = uniqueIds([
    editedId,
    ...residualIds,
    ...result.conflictingConstraints,
  ]);
  const edited = attempted.constraints.find((item) => item.id === editedId);
  const label = edited === undefined ? editedId : constraintLabel(edited);
  return {
    proposedConstraintId: editedId,
    conflictingConstraintIds: ids,
    reason: `Cannot apply ${label}: conflicts with ${formatIdList(base, ids, editedId)}. No changes were made.`,
  };
}

export function formatConflictConstraintList(
  sketch: Sketch,
  ids: readonly ConstraintId[],
): string {
  return formatIdList(sketch, ids, null);
}

function relatedExistingConflicts(
  base: Sketch,
  proposed: Constraint,
  residualIds: readonly ConstraintId[],
): ConstraintId[] {
  const proposedEntities = new Set(
    proposed.references.map((ref) => ref.entityId),
  );
  const related: ConstraintId[] = [];
  for (const existing of base.constraints) {
    if (!residualIds.includes(existing.id) && !sharesEntity(existing, proposedEntities)) {
      continue;
    }
    if (isDirectTypeConflict(existing, proposed) || residualIds.includes(existing.id)) {
      related.push(existing.id);
    }
  }
  return related;
}

function sharesEntity(
  constraint: Constraint,
  entityIds: ReadonlySet<string>,
): boolean {
  return constraint.references.some((ref) => entityIds.has(ref.entityId));
}

function isDirectTypeConflict(a: Constraint, b: Constraint): boolean {
  if (
    (a.type === "horizontal" && b.type === "vertical") ||
    (a.type === "vertical" && b.type === "horizontal")
  ) {
    return true;
  }
  if (
    (a.type === "parallel" && b.type === "perpendicular") ||
    (a.type === "perpendicular" && b.type === "parallel")
  ) {
    return true;
  }
  if (
    (a.type === "radius" && b.type === "diameter") ||
    (a.type === "diameter" && b.type === "radius")
  ) {
    return true;
  }
  if (a.type === b.type && a.type === "length") {
    return true;
  }
  return false;
}

function formatAddConflictReason(
  sketch: Sketch,
  proposed: Constraint,
  ids: readonly ConstraintId[],
): string {
  const label = constraintLabel(proposed);
  const others = formatIdList(sketch, ids, proposed.id);
  if (others === "existing constraints") {
    return `Cannot add ${label}: conflicts with existing constraints (over-constrained). No changes were made.`;
  }
  return `Cannot add ${label}: conflicts with ${others}. No changes were made.`;
}

function formatIdList(
  sketch: Sketch,
  ids: readonly ConstraintId[],
  exclude: ConstraintId | null,
): string {
  const labels: string[] = [];
  for (const id of ids) {
    if (exclude !== null && id === exclude) {
      continue;
    }
    const constraint = sketch.constraints.find((item) => item.id === id);
    labels.push(constraint === undefined ? id : `${constraintLabel(constraint)} (${id})`);
  }
  if (labels.length === 0) {
    return "existing constraints";
  }
  if (labels.length === 1) {
    return labels[0]!;
  }
  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`;
  }
  return `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`;
}

function constraintLabel(constraint: Constraint): string {
  return getConstraintTypeInfo(constraint.type)?.label ?? constraint.type;
}

function uniqueIds(ids: readonly ConstraintId[]): ConstraintId[] {
  const seen = new Set<ConstraintId>();
  const out: ConstraintId[] = [];
  for (const id of ids) {
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push(id);
  }
  return out;
}
