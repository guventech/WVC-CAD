import type { Constraint } from "../model/Constraint.ts";
import type { EntityId } from "../model/Geometry.ts";
import { isFeatureConstraintType } from "../model/Constraint.ts";

export type ConstraintListFilter = "related" | "all";

/** Constraints that reference any of the selected entity ids. */
export function constraintsRelatedToSelection(
  constraints: readonly Constraint[],
  selectedIds: readonly EntityId[],
): Constraint[] {
  if (selectedIds.length === 0) {
    return [];
  }
  const selected = new Set(selectedIds);
  return constraints.filter((constraint) =>
    constraint.references.some((ref) => selected.has(ref.entityId)),
  );
}

export function filterConstraintsForPanel(
  constraints: readonly Constraint[],
  selectedIds: readonly EntityId[],
  mode: ConstraintListFilter,
): readonly Constraint[] {
  if (mode === "all" || selectedIds.length === 0) {
    return constraints;
  }
  return constraintsRelatedToSelection(constraints, selectedIds);
}

export function isFeatureConstraintRow(constraint: Constraint): boolean {
  return isFeatureConstraintType(constraint.type);
}
