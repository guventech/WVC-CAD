import type { Point2D } from "../../sketch/geometry/Point2D.ts";
import type { Sketch } from "../../sketch/model/Sketch.ts";
import type { SelectionState } from "../../sketch/selection/SelectionManager.ts";
import { countLogicalSelection } from "../../sketch/selection/SelectionSummary.ts";
import type { SnapCandidate } from "../../sketch/selection/SnapEngine.ts";
import {
  constraintStatusTone,
  formatConstraintStatus,
} from "../../sketch/constraints/DegreesOfFreedom.ts";
import type { UnderConstrainedVisualization } from "../../sketch/constraints/UnderConstrainedViz.ts";
import type { SolverResult } from "../../sketch/solver/SolverResult.ts";
import type { ActiveTool } from "../../sketch/tools/ActiveTool.ts";
import type { LineMetrics, RectMetrics } from "../../sketch/tools/ToolTypes.ts";
import { chooseGridSpacing } from "../../sketch/viewport/Grid.ts";

type StatusBarProps = {
  readonly sketch: Sketch;
  readonly solverResult: SolverResult;
  readonly underConstrained?: UnderConstrainedVisualization | null;
  readonly cursorWorld: Point2D | null;
  readonly cameraScale: number | null;
  readonly selection: SelectionState;
  readonly activeTool: ActiveTool;
  readonly activeSnap: SnapCandidate | null;
  readonly lineMetrics: LineMetrics | null;
  readonly rectMetrics: RectMetrics | null;
  readonly circleRadiusMm: number | null;
  readonly arcSweepDegrees: number | null;
  readonly createAsConstruction: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly hasUnsavedChanges?: boolean;
};

/**
 * CAD-like status strip: primary engineering fields first (X/Y, DOF, units, Ready),
 * then compact secondary context (tool, snap, zoom, counts).
 */
export function StatusBar({
  sketch,
  solverResult,
  underConstrained = null,
  cursorWorld,
  cameraScale,
  selection,
  activeTool,
  activeSnap,
  lineMetrics,
  rectMetrics,
  circleRadiusMm,
  arcSweepDegrees,
  createAsConstruction,
  canUndo,
  canRedo,
  hasUnsavedChanges = false,
}: StatusBarProps) {
  const grid = cameraScale == null ? null : chooseGridSpacing(cameraScale);
  const selectedCount = countLogicalSelection(
    sketch.constraints,
    selection.selectedIds,
  );
  const statusLabel = formatConstraintStatus(solverResult, {
    geometryCount: sketch.geometry.length,
  });
  const tone = constraintStatusTone(solverResult.status);

  return (
    <footer className="status-bar" role="status">
      <div className="status-group status-primary" aria-label="Coordinates and solver">
        <span>{formatCoordinate("X", cursorWorld?.x)}</span>
        <span>{formatCoordinate("Y", cursorWorld?.y)}</span>
        <span className="status-divider" aria-hidden="true" />
        <span>{formatLength("L", lineMetrics?.lengthMm)}</span>
        <span>{formatAngle(lineMetrics?.angleDegrees)}</span>
        <span>{formatLength("W", rectMetrics?.widthMm)}</span>
        <span>{formatLength("H", rectMetrics?.heightMm)}</span>
        <span>{formatLength("R", circleRadiusMm ?? undefined)}</span>
        <span>{formatSweep(arcSweepDegrees ?? undefined)}</span>
        <span className="status-divider" aria-hidden="true" />
        <span
          className={`status-dof status-dof-${tone}`}
          data-testid="constraint-status"
          title={
            underConstrained !== null && solverResult.status === "under-constrained"
              ? underConstrained.summary
              : `Solver status: ${solverResult.status}`
          }
        >
          {statusLabel}
        </span>
        <span>Units: {sketch.units}</span>
        <span
          className={hasUnsavedChanges ? "status-unsaved" : undefined}
          data-testid="unsaved-indicator"
          title={
            hasUnsavedChanges
              ? "Local autosave is active; Save to download a file copy"
              : "No unsaved changes vs last Save/Open"
          }
        >
          {hasUnsavedChanges ? "Unsaved changes" : "Saved"}
        </span>
        <span className="status-ready">Ready</span>
      </div>
      <div className="status-group status-secondary" aria-label="Session context">
        <span>Tool: {activeTool}</span>
        <span>Create: {createAsConstruction ? "construction" : "solid"}</span>
        <span>Snap: {activeSnap?.label ?? "—"}</span>
        <span>
          Zoom: {cameraScale == null ? "—" : `${cameraScale.toFixed(2)} px/mm`}
        </span>
        <span>Grid: {grid == null ? "—" : `${grid.minorMm} mm`}</span>
        <span>Selected: {selectedCount}</span>
        <span>Geometry: {sketch.geometry.length}</span>
        <span>Constraints: {sketch.constraints.length}</span>
        <span>Undo: {canUndo ? "yes" : "no"}</span>
        <span>Redo: {canRedo ? "yes" : "no"}</span>
      </div>
    </footer>
  );
}

function formatCoordinate(label: string, value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return `${label}: —`;
  }
  return `${label}: ${value.toFixed(2)}`;
}

function formatLength(label: string, value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return `${label}: —`;
  }
  return `${label}: ${value.toFixed(2)} mm`;
}

function formatAngle(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return "∠: —";
  }
  return `∠: ${value.toFixed(1)}°`;
}

function formatSweep(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return "Sweep: —";
  }
  return `Sweep: ${value.toFixed(1)}°`;
}
