import { useCallback, useState } from "react";
import { createCommandHistory } from "../sketch/commands/Command.ts";
import type { Point2D } from "../sketch/geometry/Point2D.ts";
import { createEmptySketch } from "../sketch/model/Sketch.ts";
import {
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
import { selectionConstraintAction } from "../sketch/constraints/ConstraintApplicability.ts";
import { SketchCanvas } from "../ui/Canvas/SketchCanvas.tsx";
import { ConstraintContextBar } from "../ui/ConstraintContextBar/ConstraintContextBar.tsx";
import { ConstraintPanel } from "../ui/ConstraintPanel/ConstraintPanel.tsx";
import { ConstraintToolbar } from "../ui/ConstraintToolbar/ConstraintToolbar.tsx";
import { DiagnosticsPanel } from "../ui/DiagnosticsPanel/DiagnosticsPanel.tsx";
import { DocumentBar } from "../ui/DocumentBar/DocumentBar.tsx";
import { GeometryToolbar } from "../ui/GeometryToolbar/GeometryToolbar.tsx";
import { MenuBar, type MenuActionId } from "../ui/MenuBar/MenuBar.tsx";
import { PropertiesPanel } from "../ui/PropertiesPanel/PropertiesPanel.tsx";
import { StatusBar } from "../ui/StatusBar/StatusBar.tsx";
import { RecoveryDialog } from "../ui/Dialogs/RecoveryDialog.tsx";
import {
  dismissFirstRunHint,
  FirstRunHint,
  shouldShowFirstRunHint,
} from "../ui/Dialogs/FirstRunHint.tsx";
import { clearCreationChrome } from "./clearCreationChrome.ts";
import { dispatchMenuAction } from "./dispatchMenuAction.ts";
import { SAMPLE_SKETCHES } from "./sampleSketches.ts";
import { useAppKeybindings } from "./useAppKeybindings.ts";
import { useSketchAutosave } from "./useSketchAutosave.ts";
import { useSketchDocument } from "./useSketchDocument.ts";
import { useSketchFileIo } from "./useSketchFileIo.ts";

export default function App() {
  const [cursorWorld, setCursorWorld] = useState<Point2D | null>(null);
  const [activeSnap, setActiveSnap] = useState<SnapCandidate | null>(null);
  const [lineMetrics, setLineMetrics] = useState<LineMetrics | null>(null);
  const [rectMetrics, setRectMetrics] = useState<RectMetrics | null>(null);
  const [circleRadiusMm, setCircleRadiusMm] = useState<number | null>(null);
  const [arcSweepDegrees, setArcSweepDegrees] = useState<number | null>(null);
  const [polygonSides, setPolygonSides] = useState<number | null>(null);
  const [polygonSidesNudge, setPolygonSidesNudge] = useState({
    seq: 0,
    delta: 0,
  });
  const [cameraScale, setCameraScale] = useState<number | null>(null);
  const [selection, setSelection] = useState<SelectionState>(() =>
    createSelectionState(),
  );
  const [activeTool, setActiveTool] = useState<ActiveTool>("select");
  const [creationCancelRequest, setCreationCancelRequest] = useState(0);
  const [creationSessionActive, setCreationSessionActive] = useState(false);
  const [createAsConstruction, setCreateAsConstruction] = useState(false);
  const [documentFileName, setDocumentFileName] = useState<string | null>(null);
  const [showFirstRunHint, setShowFirstRunHint] = useState(() =>
    shouldShowFirstRunHint(),
  );

  const {
    sketch,
    setDocumentState,
    solverResult,
    underConstrained,
    constraintMessage,
    constraintMessageTone,
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
    handleCreatePolygon,
    handleCreateOffsetSegments,
    handleCreateSlot,
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
    handleCommitDimensionAnnotation,
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
    otherInstanceWarning,
    autosaveWarning,
    handleRestoreRecovery,
    handleDiscardRecovery,
  } = autosave;

  const {
    handleSave,
    handleSaveAs,
    handleOpen,
    handleOpenRecent,
    handleOpenSample,
    handleExportDxf,
    recentFiles,
    clearDocumentFile,
  } = useSketchFileIo({
    sketch,
    documentFileName,
    hasUnsavedChanges,
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
      setPolygonSides,
      setCreationSessionActive,
    );
  }, []);

  const nudgePolygonSides = useCallback((delta: number) => {
    setPolygonSidesNudge((current) => ({
      seq: current.seq + 1,
      delta,
    }));
  }, []);

  const handleNew = useCallback(() => {
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
    clearDocumentFile();
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
      setPolygonSides,
      setCreationSessionActive,
    );
  }, [
    autosaveStore,
    clearDocumentFile,
    hasUnsavedChanges,
    setConstraintConflict,
    setConstraintMessage,
    setDocumentState,
    setLastCleanFingerprint,
  ]);

  const toggleCreateAsConstruction = useCallback(() => {
    setCreateAsConstruction((value) => !value);
  }, []);

  const handleMenuAction = useCallback(
    (action: MenuActionId) => {
      dispatchMenuAction(action, {
        onNew: handleNew,
        onOpen: handleOpen,
        onSave: handleSave,
        onSaveAs: handleSaveAs,
        onOpenRecent: handleOpenRecent,
        onOpenSample: handleOpenSample,
        onExportDxf: handleExportDxf,
        onUndo: handleUndo,
        onRedo: handleRedo,
        onDeleteSelected: handleDeleteSelectedGeometry,
        onToggleSelectedConstruction: toggleSelectedConstruction,
        onToggleCreateAsConstruction: toggleCreateAsConstruction,
        onToolChange: handleToolChange,
        onWorldFrameDeleteBlocked: setConstraintMessage,
        sketch,
        selectedIds: selection.selectedIds,
      });
    },
    [
      handleDeleteSelectedGeometry,
      handleExportDxf,
      handleNew,
      handleOpen,
      handleOpenRecent,
      handleOpenSample,
      handleRedo,
      handleSave,
      handleSaveAs,
      handleToolChange,
      handleUndo,
      selection.selectedIds,
      setConstraintMessage,
      sketch,
      toggleCreateAsConstruction,
      toggleSelectedConstruction,
    ],
  );

  useAppKeybindings({
    sketch,
    activeTool,
    creationSessionActive,
    selectedIds: selection.selectedIds,
    onNew: handleNew,
    onOpen: handleOpen,
    onSave: handleSave,
    onSaveAs: handleSaveAs,
    onUndo: handleUndo,
    onRedo: handleRedo,
    onDeleteSelected: handleDeleteSelectedGeometry,
    onToggleSelectedConstruction: toggleSelectedConstruction,
    onToggleCreateAsConstruction: toggleCreateAsConstruction,
    onWorldFrameDeleteBlocked: setConstraintMessage,
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
  });

  const handleCreationCancelled = useCallback(() => {
    setCreationSessionActive(false);
  }, []);

  const handleContextConstraint = useCallback(
    (toolId: ActiveTool) => {
      const action = selectionConstraintAction(
        sketch,
        selection.selectedIds,
        toolId,
      );
      if (action.kind === "disabled") {
        return;
      }
      if (action.kind === "continue-pick") {
        setActiveTool(action.tool);
        return;
      }
      if (action.kind === "apply-coincident") {
        handleCreateCoincident(action.first, action.second);
        setActiveTool("select");
        return;
      }
      handleCreateConstraint(action.request);
      setActiveTool("select");
    },
    [
      handleCreateCoincident,
      handleCreateConstraint,
      selection.selectedIds,
      sketch,
    ],
  );

  return (
    <>
      {pendingRecovery !== null && (
        <RecoveryDialog
          savedAt={pendingRecovery.savedAt}
          documentLabel={pendingRecovery.documentFileName}
          otherInstanceWarning={otherInstanceWarning}
          onRestore={handleRestoreRecovery}
          onDiscard={handleDiscardRecovery}
        />
      )}
      <div className="app-shell">
      <MenuBar
        canUndo={documentCanUndo}
        canRedo={documentCanRedo}
        canDelete={selection.selectedIds.length > 0}
        canToggleConstruction={selection.selectedIds.length > 0}
        createAsConstruction={createAsConstruction}
        activeTool={activeTool}
        recentFiles={recentFiles.map((entry) => ({
          id: entry.id,
          label: entry.displayName,
        }))}
        sampleFiles={SAMPLE_SKETCHES.map((entry) => ({
          id: entry.id,
          label: entry.label,
        }))}
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
          polygonSides={polygonSides}
          onPolygonSidesDelta={nudgePolygonSides}
        />
        <ConstraintToolbar
          activeTool={activeTool}
          onToolChange={handleToolChange}
        />
      </div>
      <ConstraintContextBar
        sketch={sketch}
        selectedIds={selection.selectedIds}
        visible={activeTool === "select"}
        onAction={handleContextConstraint}
      />
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
            messageTone={constraintMessageTone}
            conflict={constraintConflict}
            onDismissConflict={dismissConstraintConflict}
            onEditDimension={handleEditDimension}
            onDeleteConstraint={handleDeleteConstraint}
            onParseError={handleDimensionParseError}
            selectedIds={selection.selectedIds}
          />
          <DiagnosticsPanel
            sketch={sketch}
            solverResult={solverResult}
            underConstrained={underConstrained}
          />
        </aside>
        <div className="canvas-host">
        {showFirstRunHint && sketch.geometry.length === 0 ? (
          <FirstRunHint
            onDismiss={() => {
              dismissFirstRunHint();
              setShowFirstRunHint(false);
            }}
          />
        ) : null}
        <SketchCanvas
          sketch={sketch}
          underConstrained={underConstrained}
          selection={selection}
          activeTool={activeTool}
          onSelectionChange={setSelection}
          onCommitDimensionText={handleCommitDimensionText}
          onCommitDimensionAnnotation={handleCommitDimensionAnnotation}
          onCreatePoint={handleCreatePoint}
          onCreateLine={handleCreateLine}
          onCreateRectangle={handleCreateRectangle}
          onCreateCircle={handleCreateCircle}
          onCreatePolygon={handleCreatePolygon}
          onCreateOffsetSegments={handleCreateOffsetSegments}
          onCreateSlot={handleCreateSlot}
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
          onPolygonSidesChange={setPolygonSides}
          onCreationSessionChange={setCreationSessionActive}
          onCameraScaleChange={setCameraScale}
          creationCancelRequest={creationCancelRequest}
          onCreationCancelled={handleCreationCancelled}
          polygonSidesNudge={polygonSidesNudge}
        />
        </div>
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
        polygonSides={polygonSides}
        createAsConstruction={createAsConstruction}
        canUndo={documentCanUndo}
        canRedo={documentCanRedo}
        hasUnsavedChanges={hasUnsavedChanges}
        autosaveWarning={autosaveWarning}
      />
      </div>
    </>
  );
}
