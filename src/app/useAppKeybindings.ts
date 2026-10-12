import { useEffect, type Dispatch, type SetStateAction } from "react";
import {
  selectionIsOnlyDatums,
  WORLD_FRAME_DELETE_BLOCKED_REASON,
} from "../sketch/commands/DeleteGeometryCommand.ts";
import type { Sketch } from "../sketch/model/Sketch.ts";
import {
  clearSelection,
  type SelectionState,
} from "../sketch/selection/SelectionManager.ts";
import type { SnapCandidate } from "../sketch/selection/SnapEngine.ts";
import type { ActiveTool } from "../sketch/tools/ActiveTool.ts";
import type { LineMetrics, RectMetrics } from "../sketch/tools/ToolTypes.ts";
import { clearCreationChrome } from "./clearCreationChrome.ts";

export type AppKeybindingHandlers = {
  readonly sketch: Sketch;
  readonly activeTool: ActiveTool;
  readonly creationSessionActive: boolean;
  readonly selectedIds: readonly string[];
  readonly onNew: () => void;
  readonly onOpen: () => void;
  readonly onSave: () => void;
  readonly onSaveAs: () => void;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onDeleteSelected: () => void;
  readonly onToggleSelectedConstruction: () => void;
  readonly onToggleCreateAsConstruction: () => void;
  readonly onWorldFrameDeleteBlocked: (message: string) => void;
  readonly setActiveTool: (tool: ActiveTool) => void;
  readonly setSelection: Dispatch<SetStateAction<SelectionState>>;
  readonly setCreationCancelRequest: Dispatch<SetStateAction<number>>;
  readonly setActiveSnap: (snap: SnapCandidate | null) => void;
  readonly setLineMetrics: (metrics: LineMetrics | null) => void;
  readonly setRectMetrics: (metrics: RectMetrics | null) => void;
  readonly setCircleRadiusMm: (radius: number | null) => void;
  readonly setArcSweepDegrees: (sweep: number | null) => void;
  readonly setPolygonSides: (sides: number | null) => void;
  readonly setCreationSessionActive: (active: boolean) => void;
};

/**
 * Global app keybindings (skipped while typing in inputs).
 * Does not own sketch geometry — only invokes document/tool callbacks.
 */
export function useAppKeybindings(handlers: AppKeybindingHandlers): void {
  const {
    sketch,
    activeTool,
    creationSessionActive,
    selectedIds,
    onNew,
    onOpen,
    onSave,
    onSaveAs,
    onUndo,
    onRedo,
    onDeleteSelected,
    onToggleSelectedConstruction,
    onToggleCreateAsConstruction,
    onWorldFrameDeleteBlocked,
    setActiveTool,
    setSelection,
    setCreationCancelRequest,
    setActiveSnap,
    setLineMetrics,
    setRectMetrics,
    setCircleRadiusMm,
    setArcSweepDegrees,
    setPolygonSides,
    setCreationSessionActive,
  } = handlers;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const mod = event.ctrlKey || event.metaKey;

      if (mod && event.key.toLowerCase() === "n") {
        event.preventDefault();
        onNew();
        return;
      }

      if (mod && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (event.shiftKey) {
          onSaveAs();
        } else {
          onSave();
        }
        return;
      }

      if (mod && event.key.toLowerCase() === "o") {
        event.preventDefault();
        onOpen();
        return;
      }

      if (mod && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        onUndo();
        return;
      }

      if (
        mod &&
        (event.key.toLowerCase() === "y" ||
          (event.key.toLowerCase() === "z" && event.shiftKey))
      ) {
        event.preventDefault();
        onRedo();
        return;
      }

      if (event.key === "Escape") {
        if (creationSessionActive) {
          event.preventDefault();
          setCreationCancelRequest((value) => value + 1);
          return;
        }
        setActiveTool("select");
        clearCreationChrome(
          setActiveSnap,
          setLineMetrics,
          setRectMetrics,
          setCircleRadiusMm,
          setArcSweepDegrees,
          setPolygonSides,
          setCreationSessionActive,
        );
        setSelection((current) => clearSelection(current));
        return;
      }

      if (event.key.toLowerCase() === "c" && !mod) {
        event.preventDefault();
        if (activeTool === "select" && selectedIds.length > 0) {
          onToggleSelectedConstruction();
        } else {
          onToggleCreateAsConstruction();
        }
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        if (selectedIds.length === 0) {
          return;
        }
        if (selectionIsOnlyDatums(sketch, selectedIds)) {
          onWorldFrameDeleteBlocked(WORLD_FRAME_DELETE_BLOCKED_REASON);
          return;
        }
        onDeleteSelected();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    activeTool,
    creationSessionActive,
    onDeleteSelected,
    onNew,
    onOpen,
    onRedo,
    onSave,
    onSaveAs,
    onToggleCreateAsConstruction,
    onToggleSelectedConstruction,
    onUndo,
    onWorldFrameDeleteBlocked,
    selectedIds,
    setActiveSnap,
    setActiveTool,
    setArcSweepDegrees,
    setCircleRadiusMm,
    setCreationCancelRequest,
    setCreationSessionActive,
    setLineMetrics,
    setPolygonSides,
    setRectMetrics,
    setSelection,
    sketch,
  ]);
}
