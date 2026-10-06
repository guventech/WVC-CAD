import type { EntityId } from "../model/Geometry.ts";

export interface SelectionState {
  readonly selectedIds: readonly EntityId[];
  readonly hoveredId: EntityId | null;
}

export function createSelectionState(): SelectionState {
  return {
    selectedIds: [],
    hoveredId: null,
  };
}

export function isSelected(state: SelectionState, id: EntityId): boolean {
  return state.selectedIds.includes(id);
}

export function setHovered(
  state: SelectionState,
  hoveredId: EntityId | null,
): SelectionState {
  if (state.hoveredId === hoveredId) {
    return state;
  }
  return {
    ...state,
    hoveredId,
  };
}

export function clearSelection(state: SelectionState): SelectionState {
  if (state.selectedIds.length === 0) {
    return state;
  }
  return {
    ...state,
    selectedIds: [],
  };
}

/**
 * Replace selection with one entity, or clear when `entityId` is null.
 */
export function selectOnly(
  state: SelectionState,
  entityId: EntityId | null,
): SelectionState {
  if (entityId === null) {
    return clearSelection(state);
  }
  if (state.selectedIds.length === 1 && state.selectedIds[0] === entityId) {
    return state;
  }
  return {
    ...state,
    selectedIds: [entityId],
  };
}

/**
 * Ctrl/Shift-style multi-select toggle.
 */
export function toggleInSelection(
  state: SelectionState,
  entityId: EntityId,
): SelectionState {
  if (isSelected(state, entityId)) {
    return {
      ...state,
      selectedIds: state.selectedIds.filter((id) => id !== entityId),
    };
  }
  return {
    ...state,
    selectedIds: [...state.selectedIds, entityId],
  };
}

export function applyClickSelection(
  state: SelectionState,
  entityId: EntityId | null,
  options: { readonly additive: boolean },
): SelectionState {
  if (entityId === null) {
    return options.additive ? state : clearSelection(state);
  }
  if (options.additive) {
    return toggleInSelection(state, entityId);
  }
  return selectOnly(state, entityId);
}
