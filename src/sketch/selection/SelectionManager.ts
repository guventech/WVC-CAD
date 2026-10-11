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
 * Drop selected/hovered ids that are no longer present in the sketch
 * (e.g. after trim, fillet, or load that replaces entities).
 */
export function pruneSelectionToExisting(
  state: SelectionState,
  existingIds: ReadonlySet<EntityId>,
): SelectionState {
  const selectedIds = state.selectedIds.filter((id) => existingIds.has(id));
  const hoveredId =
    state.hoveredId !== null && existingIds.has(state.hoveredId)
      ? state.hoveredId
      : null;
  if (
    selectedIds.length === state.selectedIds.length &&
    hoveredId === state.hoveredId
  ) {
    return state;
  }
  return { ...state, selectedIds, hoveredId };
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
