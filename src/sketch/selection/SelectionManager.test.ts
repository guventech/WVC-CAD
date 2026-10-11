import { describe, expect, it } from "vitest";
import {
  applyClickSelection,
  clearSelection,
  createSelectionState,
  pruneSelectionToExisting,
  selectOnly,
  setHovered,
  toggleInSelection,
} from "./SelectionManager.ts";

describe("SelectionManager", () => {
  it("supports single selection and deselection", () => {
    let state = createSelectionState();
    state = selectOnly(state, "a");
    expect(state.selectedIds).toEqual(["a"]);
    state = clearSelection(state);
    expect(state.selectedIds).toEqual([]);
  });

  it("supports multi-selection via additive toggles", () => {
    let state = createSelectionState();
    state = applyClickSelection(state, "a", { additive: false });
    state = applyClickSelection(state, "b", { additive: true });
    expect(state.selectedIds).toEqual(["a", "b"]);
    state = applyClickSelection(state, "a", { additive: true });
    expect(state.selectedIds).toEqual(["b"]);
  });

  it("clears selection on empty click unless additive", () => {
    let state = selectOnly(createSelectionState(), "a");
    state = applyClickSelection(state, null, { additive: false });
    expect(state.selectedIds).toEqual([]);

    state = selectOnly(createSelectionState(), "a");
    state = applyClickSelection(state, null, { additive: true });
    expect(state.selectedIds).toEqual(["a"]);
  });

  it("tracks hover independently from selection", () => {
    let state = selectOnly(createSelectionState(), "a");
    state = setHovered(state, "b");
    expect(state.selectedIds).toEqual(["a"]);
    expect(state.hoveredId).toBe("b");
    state = setHovered(state, null);
    expect(state.hoveredId).toBeNull();
  });

  it("toggleInSelection appends and removes", () => {
    let state = createSelectionState();
    state = toggleInSelection(state, "x");
    state = toggleInSelection(state, "y");
    state = toggleInSelection(state, "x");
    expect(state.selectedIds).toEqual(["y"]);
  });

  it("prunes selected and hovered ids missing from the sketch", () => {
    let state = selectOnly(createSelectionState(), "a");
    state = applyClickSelection(state, "b", { additive: true });
    state = setHovered(state, "gone");
    state = pruneSelectionToExisting(state, new Set(["a"]));
    expect(state.selectedIds).toEqual(["a"]);
    expect(state.hoveredId).toBeNull();
  });
});
