import { useCallback, useEffect, useState } from "react";
import { createCommandHistory } from "../sketch/commands/Command.ts";
import {
  selectionIsOnlyDatums,
  WORLD_FRAME_DELETE_BLOCKED_REASON,
} from "../sketch/commands/DeleteGeometryCommand.ts";
import type { Point2D } from "../sketch/geometry/Point2D.ts";
import { createEmptySketch } from "../sketch/model/Sketch.ts";
import {
  clearSelection,
  createSelectionState,
  type SelectionState,
} from "../sketch/selection/SelectionManager.ts";
import type { SnapCandidate } from "../sketch/selection/SnapEngine.ts";
import {
  clearAutosaveStore,
  emptySketchCleanFingerprint,
} from "../sketch/serialization/SketchAutosave.ts";
import type { ActiveTool } from "../sketch/tools/ActiveTool.ts";
import type { LineMetrics, RectMetrics } from "../sketch/tools/ToolTypes.ts";
import { SketchCanvas } from "../ui/Canvas/SketchCanvas.tsx";
import { ConstraintPanel } from "../ui/ConstraintPanel/ConstraintPanel.tsx";
import { ConstraintToolbar } from "../ui/ConstraintToolbar/ConstraintToolbar.tsx";
import { DiagnosticsPanel } from "../ui/DiagnosticsPanel/DiagnosticsPanel.tsx";
import { DocumentBar } from "../ui/DocumentBar/DocumentBar.tsx";
import { GeometryToolbar } from "../ui/GeometryToolbar/GeometryToolbar.tsx";
import { MenuBar, type MenuActionId } from "../ui/MenuBar/MenuBar.tsx";
import { PropertiesPanel } from "../ui/PropertiesPanel/PropertiesPanel.tsx";
import { StatusBar } from "../ui/StatusBar/StatusBar.tsx";
import { RecoveryDialog } from "../ui/Dialogs/RecoveryDialog.tsx";
import { useSketchAutosave } from "./useSketchAutosave.ts";
import { useSketchDocument } from "./useSketchDocument.ts";
import { useSketchFileIo } from "./useSketchFileIo.ts";

function clearCreationChrome(
  setActiveSnap: (snap: SnapCandidate | null) => void,
  setLineMetrics: (metrics: LineMetrics | null) => void,
  setRectMetrics: (metrics: RectMetrics | null) => void,
  setCircleRadiusMm: (radius: number | null) => void,
  setArcSweepDegrees: (sweep: number | null) => void,
  setCreationSessionActive: (active: boolean) => void,
): void {
  setActiveSnap(null);
  setLineMetrics(null);
  setRectMetrics(null);
  setCircleRadiusMm(null);
  setArcSweepDegrees(null);
  setCreationSessionActive(false);
}

export default function App() {
  const [cursorWorld, setCursorWorld] = useState<Point2D | null>(null);
  const [activeSnap, setActiveSnap] = useState<SnapCandidate | null>(null);
  const [lineMetrics, setLineMetrics] = useState<LineMetrics | null>(null);
  const [rectMetrics, setRectMetrics] = useState<RectMetrics | null>(null);
  const [circleRadiusMm, setCircleRadiusMm] = useState<number | null>(null);
  const [arcSweepDegrees, setArcSweepDegrees] = useState<number | null>(null);
  const [cameraScale, setCameraScale] = useState<number | null>(null);
  const [selection, setSelection] = useState<SelectionState>(() =>
    createSelectionState(),
  );
  const [activeTool, setActiveTool] = useState<ActiveTool>("select");
  const [creationCancelRequest, setCreationCancelRequest] = useState(0);
  const [creationSessionActive, setCreationSessionActive] = useState(false);
  const [createAsConstruction, setCreateAsConstruction] = useState(false);
  const [documentFileName, setDocumentFileName] = useState<string | null>(null);

  const {
    sketch,
    setDocumentState,
    solverResult,
    underConstrained,
    constraintMessage,
    constraintConflict,
    setConstraintMessage,
    setConstraintConflict,
    canUndo: documentCanUndo,
    canRedo: documentCanRedo,
    undoLabel,
    redoLabel,
    toggleSelectedConstruction,
    handleUndo,
    handleRedo,
    handleDeleteConstraint,
    handleDeleteSelectedGeometry,
    handleCreatePoint,
    handleCreateLine,
    handleCreateRectangle,
    handleCreateCircle,
    handleCreateArc,
    handleCommitPointMove,
    handleCreateCoincident,
    handleCreateConstraint,
    handleTrim,
    handleExtend,
    handleMirror,
    handleFillet,
    handleChamfer,
    handleEditDimension,
    handleCommitDimensionText,
    dismissConstraintConflict,
    handleDimensionParseError,
  } = useSketchDocument({
    selectedIds: selection.selectedIds,
    createAsConstruction,
    setSelection,
  });

  const autosave = useSketchAutosave({
    sketch,
    documentFileName,
    setDocumentState,
    setDocumentFileName,
    setSelection,
    setActiveTool,
    setConstraintMessage,
    setConstraintConflict,
  });
  const {
    autosaveStore,
    setLastCleanFingerprint,
    hasUnsavedChanges,
    pendingRecovery,
    handleRestoreRecovery,
    handleDiscardRecovery,
  } = autosave;

  const { handleSave, handleOpen } = useSketchFileIo({
    sketch,
    documentFileName,
    setDocumentFileName,
    setDocumentState,
    setLastCleanFingerprint,
    autosaveStore,
    setSelection,
    setActiveTool,
    setConstraintMessage,
    setConstraintConflict,
  });

  const handleToolChange = useCallback((tool: ActiveTool) => {
    setActiveTool(tool);
    clearCreationChrome(
      setActiveSnap,
      setLineMetrics,
      setRectMetrics,
      setCircleRadiusMm,
      setArcSweepDegrees,
      setCreationSessionActive,
    );
  }, []);

  const handleNewSketch = useCallback(() => {
    if (hasUnsavedChanges) {
      const proceed = window.confirm(
        "Discard unsaved changes and start a new sketch?",
      );
      if (!proceed) {
        return;
      }
    }
    setDocumentState({
      sketch: createEmptySketch(),
      history: createCommandHistory(),
    });
    setDocumentFileName(null);
    setLastCleanFingerprint(emptySketchCleanFingerprint());
    clearAutosaveStore(autosaveStore);
    setSelection(() => createSelectionState());
    setActiveTool("select");
    setConstraintMessage(null);
    setConstraintConflict(null);
    clearCreationChrome(
      setActiveSnap,
      setLineMetrics,
      setRectMetrics,
      setCircleRadiusMm,
      setArcSweepDegrees,
      setCreationSessionActive,
    );
  }, [
    autosaveStore,
    hasUnsavedChanges,
    setConstraintConflict,
    setConstraintMessage,
    setDocumentState,
    setLastCleanFingerprint,
  ]);

  const handleNew = handleNewSketch;

  const handleMenuAction = useCallback(
    (action: MenuActionId) => {
      if (action === "file-new") {
        handleNew();
        return;
      }
      if (action === "file-open") {
        handleOpen();
        return;
      }
      if (action === "file-save") {
        handleSave();
        return;
      }
      if (action === "edit-undo") {
        handleUndo();
        return;
      }
      if (action === "edit-redo") {
        handleRedo();
        return;
      }
      if (action === "edit-delete") {
        if (selection.selectedIds.length === 0) {
          return;
        }
        if (selectionIsOnlyDatums(sketch, selection.selectedIds)) {
          setConstraintMessage(WORLD_FRAME_DELETE_BLOCKED_REASON);
          return;
        }
        handleDeleteSelectedGeometry();
        return;
      }
      if (action === "edit-toggle-construction") {
        toggleSelectedConstruction();
        return;
      }
      if (action === "edit-construction-mode") {
        setCreateAsConstruction((value) => !value);
        return;
      }
      if (action.startsWith("tool:")) {
        handleToolChange(action.slice("tool:".length) as ActiveTool);
      }
    },
    [
      handleDeleteSelectedGeometry,
      handleNew,
      handleOpen,
      handleRedo,
      handleSave,
      handleToolChange,
      handleUndo,
      selection.selectedIds,
      setConstraintMessage,
      sketch,
      toggleSelectedConstruction,
    ],
  );

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
        handleNew();
        return;
      }

      if (mod && event.key.toLowerCase() === "s") {
        event.preventDefault();
        handleSave();
        return;
      }

      if (mod && event.key.toLowerCase() === "o") {
        event.preventDefault();
        handleOpen();
        return;
      }

      if (mod && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
        return;
      }

      if (
        mod &&
        (event.key.toLowerCase() === "y" ||
          (event.key.toLowerCase() === "z" && event.shiftKey))
      ) {
        event.preventDefault();
        handleRedo();
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
          setCreationSessionActive,
        );
        setSelection((current) => clearSelection(current));
        return;
      }

      if (event.key.toLowerCase() === "c" && !mod) {
        event.preventDefault();
        if (activeTool === "select" && selection.selectedIds.length > 0) {
          toggleSelectedConstruction();
        } else {
          setCreateAsConstruction((value) => !value);
        }
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        if (selection.selectedIds.length === 0) {
          return;
        }
        if (selectionIsOnlyDatums(sketch, selection.selectedIds)) {
          setConstraintMessage(WORLD_FRAME_DELETE_BLOCKED_REASON);
          return;
        }
        handleDeleteSelectedGeometry();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    activeTool,
    creationSessionActive,
    handleDeleteSelectedGeometry,
    handleNew,
    handleOpen,
    handleRedo,
    handleSave,
    handleUndo,
    selection.selectedIds,
    setConstraintMessage,
    sketch,
    toggleSelectedConstruction,
  ]);

  const handleCreationCancelled = useCallback(() => {
    setCreationSessionActive(false);
  }, []);

  return (
    <div className="app-shell">
      {pendingRecovery !== null && (
        <RecoveryDialog
          savedAt={pendingRecovery.savedAt}
          documentLabel={pendingRecovery.documentFileName}
          onRestore={handleRestoreRecovery}
          onDiscard={handleDiscardRecovery}
        />
      )}
      <MenuBar
        canUndo={documentCanUndo}
        canRedo={documentCanRedo}
        canDelete={selection.selectedIds.length > 0}
        canToggleConstruction={selection.selectedIds.length > 0}
        createAsConstruction={createAsConstruction}
        activeTool={activeTool}
        onAction={handleMenuAction}
      />
      <DocumentBar
        canUndo={documentCanUndo}
        canRedo={documentCanRedo}
        undoLabel={undoLabel}
        redoLabel={redoLabel}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onOpen={handleOpen}
        onSave={handleSave}
        onNew={handleNew}
        documentLabel={documentFileName}
        hasUnsavedChanges={hasUnsavedChanges}
      />
      <div className="tool-row" aria-label="Toolbars">
        <GeometryToolbar
          activeTool={activeTool}
          onToolChange={handleToolChange}
          createAsConstruction={createAsConstruction}
          onCreateAsConstructionChange={setCreateAsConstruction}
          canToggleConstruction={selection.selectedIds.length > 0}
          onToggleConstruction={toggleSelectedConstruction}
        />
        <ConstraintToolbar
          activeTool={activeTool}
          onToolChange={handleToolChange}
        />
      </div>
      <div className="workspace">
        <aside className="side-panels" aria-label="Sketch panels">
          <PropertiesPanel
            geometry={sketch.geometry}
            constraints={sketch.constraints}
            selection={selection}
            frame={sketch.frame}
          />
          <ConstraintPanel
            sketch={sketch}
            solverResult={solverResult}
            underConstrained={underConstrained}
            message={constraintMessage}
            conflict={constraintConflict}
            onDismissConflict={dismissConstraintConflict}
            onEditDimension={handleEditDimension}
            onDeleteConstraint={handleDeleteConstraint}
            onParseError={handleDimensionParseError}
          />
          <DiagnosticsPanel sketch={sketch} />
        </aside>
        <SketchCanvas
          sketch={sketch}
          selection={selection}
          activeTool={activeTool}
          onSelectionChange={setSelection}
          onCommitDimensionText={handleCommitDimensionText}
          onCreatePoint={handleCreatePoint}
          onCreateLine={handleCreateLine}
          onCreateRectangle={handleCreateRectangle}
          onCreateCircle={handleCreateCircle}
          onCreateArc={handleCreateArc}
          onCreateCoincident={handleCreateCoincident}
          onCreateConstraint={handleCreateConstraint}
          onTrim={handleTrim}
          onExtend={handleExtend}
          onMirror={handleMirror}
          onFillet={handleFillet}
          onChamfer={handleChamfer}
          onCommitPointMove={handleCommitPointMove}
          onCursorWorldChange={setCursorWorld}
          onSnapChange={setActiveSnap}
          onLineMetricsChange={setLineMetrics}
          onRectMetricsChange={setRectMetrics}
          onCircleRadiusChange={setCircleRadiusMm}
          onArcSweepChange={setArcSweepDegrees}
          onCreationSessionChange={setCreationSessionActive}
          onCameraScaleChange={setCameraScale}
          creationCancelRequest={creationCancelRequest}
          onCreationCancelled={handleCreationCancelled}
        />
      </div>
      <StatusBar
        sketch={sketch}
        solverResult={solverResult}
        underConstrained={underConstrained}
        cursorWorld={cursorWorld}
        cameraScale={cameraScale}
        selection={selection}
        activeTool={activeTool}
        activeSnap={activeSnap}
        lineMetrics={lineMetrics}
        rectMetrics={rectMetrics}
        circleRadiusMm={circleRadiusMm}
        arcSweepDegrees={arcSweepDegrees}
        createAsConstruction={createAsConstruction}
        canUndo={documentCanUndo}
        canRedo={documentCanRedo}
        hasUnsavedChanges={hasUnsavedChanges}
      />
    </div>
  );
}
