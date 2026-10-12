import {
  selectionIsOnlyDatums,
  WORLD_FRAME_DELETE_BLOCKED_REASON,
} from "../sketch/commands/DeleteGeometryCommand.ts";
import type { Sketch } from "../sketch/model/Sketch.ts";
import type { ActiveTool } from "../sketch/tools/ActiveTool.ts";
import type { MenuActionId } from "../ui/MenuBar/MenuBar.tsx";

export type MenuActionHandlers = {
  readonly onNew: () => void;
  readonly onOpen: () => void;
  readonly onSave: () => void;
  readonly onSaveAs: () => void;
  readonly onOpenRecent: (recentId: string) => void;
  readonly onOpenSample: (sampleId: string) => void;
  readonly onExportDxf: () => void;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onDeleteSelected: () => void;
  readonly onToggleSelectedConstruction: () => void;
  readonly onToggleCreateAsConstruction: () => void;
  readonly onToolChange: (tool: ActiveTool) => void;
  readonly onWorldFrameDeleteBlocked: (message: string) => void;
  readonly sketch: Sketch;
  readonly selectedIds: readonly string[];
};

/**
 * Map a MenuBar action id to document/tool callbacks.
 * Pure dispatch — no React; callers own state updates.
 */
export function dispatchMenuAction(
  action: MenuActionId,
  handlers: MenuActionHandlers,
): void {
  if (action === "file-new") {
    handlers.onNew();
    return;
  }
  if (action === "file-open") {
    handlers.onOpen();
    return;
  }
  if (action === "file-save") {
    handlers.onSave();
    return;
  }
  if (action === "file-save-as") {
    handlers.onSaveAs();
    return;
  }
  if (action.startsWith("file-recent:")) {
    const recentId = action.slice("file-recent:".length);
    if (recentId !== "__none__") {
      handlers.onOpenRecent(recentId);
    }
    return;
  }
  if (action.startsWith("file-sample:")) {
    handlers.onOpenSample(action.slice("file-sample:".length));
    return;
  }
  if (action === "file-export-dxf") {
    handlers.onExportDxf();
    return;
  }
  if (action === "edit-undo") {
    handlers.onUndo();
    return;
  }
  if (action === "edit-redo") {
    handlers.onRedo();
    return;
  }
  if (action === "edit-delete") {
    if (handlers.selectedIds.length === 0) {
      return;
    }
    if (selectionIsOnlyDatums(handlers.sketch, handlers.selectedIds)) {
      handlers.onWorldFrameDeleteBlocked(WORLD_FRAME_DELETE_BLOCKED_REASON);
      return;
    }
    handlers.onDeleteSelected();
    return;
  }
  if (action === "edit-toggle-construction") {
    handlers.onToggleSelectedConstruction();
    return;
  }
  if (action === "edit-construction-mode") {
    handlers.onToggleCreateAsConstruction();
    return;
  }
  if (action.startsWith("tool:")) {
    handlers.onToolChange(action.slice("tool:".length) as ActiveTool);
  }
}
