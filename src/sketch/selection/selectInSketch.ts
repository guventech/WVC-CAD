import type { Constraint } from "../model/Constraint.ts";
import type { EntityId } from "../model/Geometry.ts";
import {
  clearSelection,
  isSelected,
  type SelectionState,
} from "./SelectionManager.ts";
import { entityIdsForSelectionTarget } from "./SelectionSummary.ts";

/**
 * Select an entity, expanding rectangle members to the whole feature.
 */
export function selectEntityInSketch(
  state: SelectionState,
  constraints: readonly Constraint[],
  entityId: EntityId | null,
  options?: { readonly additive?: boolean },
): SelectionState {
  if (entityId === null) {
    return options?.additive ? state : clearSelection(state);
  }

  const targets = entityIdsForSelectionTarget(constraints, entityId);

  if (options?.additive) {
    return toggleIdsInSelection(state, targets);
  }

  return selectExactIds(state, targets);
}

function selectExactIds(
  state: SelectionState,
  ids: readonly EntityId[],
): SelectionState {
  if (
    state.selectedIds.length === ids.length &&
    ids.every((id, index) => state.selectedIds[index] === id)
  ) {
    return state;
  }
  return {
    ...state,
    selectedIds: [...ids],
  };
}

function toggleIdsInSelection(
  state: SelectionState,
  ids: readonly EntityId[],
): SelectionState {
  const allSelected = ids.every((id) => isSelected(state, id));
  if (allSelected) {
    const remove = new Set(ids);
    return {
      ...state,
      selectedIds: state.selectedIds.filter((id) => !remove.has(id)),
    };
  }

  const next = [...state.selectedIds];
  for (const id of ids) {
    if (!next.includes(id)) {
      next.push(id);
    }
  }
  return {
    ...state,
    selectedIds: next,
  };
}
