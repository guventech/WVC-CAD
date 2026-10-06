import type { Dispatch, SetStateAction } from "react";
import type { ConstraintCreateRequest } from "../../sketch/commands/AddMaintainedConstraintCommand.ts";
import type { GeometryDragTarget } from "../../sketch/commands/GeometryDrag.ts";
import type { Point2D } from "../../sketch/geometry/Point2D.ts";
import type { ConstraintReference } from "../../sketch/model/Constraint.ts";
import type { SelectionState } from "../../sketch/selection/SelectionManager.ts";
import type { SnapCandidate } from "../../sketch/selection/SnapEngine.ts";
import type {
  ArcPreview,
  CirclePreview,
  LineMetrics,
  LinePreview,
  PointDragState,
  RectMetrics,
  RectanglePreview,
  ToolPointerResult,
} from "../../sketch/tools/ToolTypes.ts";
import type { TrimExtendRequest } from "../../sketch/tools/TrimExtendTool.ts";
import type { MirrorRequest } from "../../sketch/tools/MirrorTool.ts";
import type { FilletChamferRequest } from "../../sketch/tools/FilletChamferTool.ts";

export type CreationChromeCallbacks = {
  readonly onLineMetricsChange?: (metrics: LineMetrics | null) => void;
  readonly onRectMetricsChange?: (metrics: RectMetrics | null) => void;
  readonly onCircleRadiusChange?: (radiusMm: number | null) => void;
  readonly onArcSweepChange?: (sweepDegrees: number | null) => void;
  readonly onCreationSessionChange?: (active: boolean) => void;
  readonly onCreationCancelled?: () => void;
};

export type ToolResultCallbacks = CreationChromeCallbacks & {
  readonly onSelectionChange: (selection: SelectionState) => void;
  readonly onCreatePoint: (
    position: Point2D,
    options?: { readonly midpointOf?: string },
  ) => void;
  readonly onCreateLine: (
    start: Point2D,
    end: Point2D,
    options?: {
      readonly startMidpointOf?: string;
      readonly endMidpointOf?: string;
    },
  ) => void;
  readonly onCreateRectangle: (cornerA: Point2D, cornerB: Point2D) => void;
  readonly onCreateCircle: (
    center: Point2D,
    radiusPoint: Point2D,
    options?: { readonly centerMidpointOf?: string },
  ) => void;
  readonly onCreateArc: (
    center: Point2D,
    startPoint: Point2D,
    endPoint: Point2D,
  ) => void;
  readonly onCreateCoincident: (
    first: ConstraintReference,
    second: ConstraintReference,
  ) => void;
  readonly onCreateConstraint: (request: ConstraintCreateRequest) => void;
  readonly onTrim: (request: TrimExtendRequest) => void;
  readonly onExtend: (request: TrimExtendRequest) => void;
  readonly onMirror: (request: MirrorRequest) => void;
  readonly onFillet: (request: FilletChamferRequest) => void;
  readonly onChamfer: (request: FilletChamferRequest) => void;
  readonly onCommitPointMove: (
    target: GeometryDragTarget,
    from: Point2D,
    to: Point2D,
  ) => void;
  readonly onCursorWorldChange?: (point: Point2D | null) => void;
};

export type ToolResultLocalState = {
  readonly dragRef: { current: PointDragState | null };
  readonly setPreviewPoint: Dispatch<SetStateAction<Point2D | null>>;
  readonly setPreviewLine: Dispatch<SetStateAction<LinePreview | null>>;
  readonly setPreviewRectangle: Dispatch<SetStateAction<RectanglePreview | null>>;
  readonly setPreviewCircle: Dispatch<SetStateAction<CirclePreview | null>>;
  readonly setPreviewArc: Dispatch<SetStateAction<ArcPreview | null>>;
  readonly setActiveSnap: Dispatch<SetStateAction<SnapCandidate | null>>;
  readonly setDragPreview: Dispatch<SetStateAction<PointDragState | null>>;
  readonly setIsDraggingPoint: Dispatch<SetStateAction<boolean>>;
};

export function applyToolResult(
  result: ToolPointerResult,
  callbacks: ToolResultCallbacks,
  local: ToolResultLocalState,
): void {
  if (result.selection !== undefined) {
    callbacks.onSelectionChange(result.selection);
  }
  if (result.previewPoint !== undefined) {
    local.setPreviewPoint(result.previewPoint);
  }
  if (result.previewLine !== undefined) {
    local.setPreviewLine(result.previewLine);
  }
  if (result.previewRectangle !== undefined) {
    local.setPreviewRectangle(result.previewRectangle);
  }
  if (result.previewCircle !== undefined) {
    local.setPreviewCircle(result.previewCircle);
  }
  if (result.previewArc !== undefined) {
    local.setPreviewArc(result.previewArc);
  }
  if (result.lineMetrics !== undefined) {
    callbacks.onLineMetricsChange?.(result.lineMetrics);
  }
  if (result.rectMetrics !== undefined) {
    callbacks.onRectMetricsChange?.(result.rectMetrics);
  }
  if (result.circleRadiusMm !== undefined) {
    callbacks.onCircleRadiusChange?.(result.circleRadiusMm);
  }
  if (result.arcSweepDegrees !== undefined) {
    callbacks.onArcSweepChange?.(result.arcSweepDegrees);
  }
  if (result.creationSessionActive !== undefined) {
    callbacks.onCreationSessionChange?.(result.creationSessionActive);
  }
  if (result.activeSnap !== undefined) {
    local.setActiveSnap(result.activeSnap);
  }
  if (result.cursorWorld !== undefined) {
    callbacks.onCursorWorldChange?.(result.cursorWorld);
  }
  if (result.createPointAt !== undefined) {
    callbacks.onCreatePoint(result.createPointAt.position, {
      midpointOf: result.createPointAt.midpointOf,
    });
  }
  if (result.createLine !== undefined) {
    callbacks.onCreateLine(result.createLine.start, result.createLine.end, {
      startMidpointOf: result.createLine.startMidpointOf,
      endMidpointOf: result.createLine.endMidpointOf,
    });
  }
  if (result.createRectangle !== undefined) {
    callbacks.onCreateRectangle(
      result.createRectangle.cornerA,
      result.createRectangle.cornerB,
    );
  }
  if (result.createCircle !== undefined) {
    callbacks.onCreateCircle(
      result.createCircle.center,
      result.createCircle.radiusPoint,
      { centerMidpointOf: result.createCircle.centerMidpointOf },
    );
  }
  if (result.createArc !== undefined) {
    callbacks.onCreateArc(
      result.createArc.center,
      result.createArc.startPoint,
      result.createArc.endPoint,
    );
  }
  if (result.createCoincident !== undefined) {
    callbacks.onCreateCoincident(
      result.createCoincident.first,
      result.createCoincident.second,
    );
  }
  if (result.createConstraint !== undefined) {
    callbacks.onCreateConstraint(result.createConstraint);
  }
  if (result.trimRequest !== undefined) {
    callbacks.onTrim(result.trimRequest);
  }
  if (result.extendRequest !== undefined) {
    callbacks.onExtend(result.extendRequest);
  }
  if (result.mirrorRequest !== undefined) {
    callbacks.onMirror(result.mirrorRequest);
  }
  if (result.filletRequest !== undefined) {
    callbacks.onFillet(result.filletRequest);
  }
  if (result.chamferRequest !== undefined) {
    callbacks.onChamfer(result.chamferRequest);
  }
  if (result.beginPointDrag !== undefined) {
    local.dragRef.current = result.beginPointDrag;
    local.setDragPreview(result.beginPointDrag);
    local.setIsDraggingPoint(true);
  }
  if (result.pointDragPreview !== undefined && local.dragRef.current !== null) {
    const next: PointDragState = {
      ...local.dragRef.current,
      currentPosition: result.pointDragPreview,
    };
    local.dragRef.current = next;
    local.setDragPreview(next);
  }
  if (result.commitPointDrag !== undefined) {
    callbacks.onCommitPointMove(
      result.commitPointDrag.target,
      result.commitPointDrag.from,
      result.commitPointDrag.to,
    );
    local.dragRef.current = null;
    local.setDragPreview(null);
    local.setIsDraggingPoint(false);
  }
}
