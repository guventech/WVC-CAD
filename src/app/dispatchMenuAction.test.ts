import { describe, expect, it, vi } from "vitest";
import { WORLD_FRAME_DELETE_BLOCKED_REASON } from "../sketch/commands/DeleteGeometryCommand.ts";
import { createEmptySketch } from "../sketch/model/Sketch.ts";
import {
  dispatchMenuAction,
  type MenuActionHandlers,
} from "./dispatchMenuAction.ts";

function handlers(
  overrides: Partial<MenuActionHandlers> = {},
): MenuActionHandlers {
  return {
    onNew: vi.fn(),
    onOpen: vi.fn(),
    onSave: vi.fn(),
    onSaveAs: vi.fn(),
    onOpenRecent: vi.fn(),
    onOpenSample: vi.fn(),
    onExportDxf: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onDeleteSelected: vi.fn(),
    onToggleSelectedConstruction: vi.fn(),
    onToggleCreateAsConstruction: vi.fn(),
    onToolChange: vi.fn(),
    onWorldFrameDeleteBlocked: vi.fn(),
    sketch: createEmptySketch(),
    selectedIds: [],
    ...overrides,
  };
}

describe("dispatchMenuAction", () => {
  it("routes file and edit actions", () => {
    const h = handlers();
    dispatchMenuAction("file-new", h);
    dispatchMenuAction("file-open", h);
    dispatchMenuAction("file-save", h);
    dispatchMenuAction("file-save-as", h);
    dispatchMenuAction("file-export-dxf", h);
    dispatchMenuAction("edit-undo", h);
    dispatchMenuAction("edit-redo", h);
    expect(h.onNew).toHaveBeenCalledOnce();
    expect(h.onOpen).toHaveBeenCalledOnce();
    expect(h.onSave).toHaveBeenCalledOnce();
    expect(h.onSaveAs).toHaveBeenCalledOnce();
    expect(h.onExportDxf).toHaveBeenCalledOnce();
    expect(h.onUndo).toHaveBeenCalledOnce();
    expect(h.onRedo).toHaveBeenCalledOnce();
  });

  it("opens recent and sample ids; ignores __none__", () => {
    const h = handlers();
    dispatchMenuAction("file-recent:mem-1", h);
    dispatchMenuAction("file-recent:__none__", h);
    dispatchMenuAction("file-sample:anchored", h);
    expect(h.onOpenRecent).toHaveBeenCalledExactlyOnceWith("mem-1");
    expect(h.onOpenSample).toHaveBeenCalledExactlyOnceWith("anchored");
  });

  it("switches tools via tool: prefix", () => {
    const h = handlers();
    dispatchMenuAction("tool:line", h);
    expect(h.onToolChange).toHaveBeenCalledExactlyOnceWith("line");
  });

  it("deletes selection or blocks datum-only delete", () => {
    const sketch = createEmptySketch();
    const deleteSelected = handlers({
      sketch,
      selectedIds: ["line-1"],
    });
    dispatchMenuAction("edit-delete", deleteSelected);
    expect(deleteSelected.onDeleteSelected).toHaveBeenCalledOnce();

    const datumOnly = handlers({
      sketch,
      selectedIds: [sketch.frame.originId],
    });
    dispatchMenuAction("edit-delete", datumOnly);
    expect(datumOnly.onDeleteSelected).not.toHaveBeenCalled();
    expect(datumOnly.onWorldFrameDeleteBlocked).toHaveBeenCalledExactlyOnceWith(
      WORLD_FRAME_DELETE_BLOCKED_REASON,
    );
  });

  it("toggles construction modes", () => {
    const h = handlers();
    dispatchMenuAction("edit-toggle-construction", h);
    dispatchMenuAction("edit-construction-mode", h);
    expect(h.onToggleSelectedConstruction).toHaveBeenCalledOnce();
    expect(h.onToggleCreateAsConstruction).toHaveBeenCalledOnce();
  });
});
