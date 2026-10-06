import { memo, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { GeometryDragTarget } from "../../sketch/commands/GeometryDrag.ts";
import { applyGeometryDragWithConstraints } from "../../sketch/commands/GeometryEdit.ts";
import {
  formatDimensionInputValue,
} from "../../sketch/constraints/DimensionInput.ts";
import { isSupportedDimensionType } from "../../sketch/constraints/Dimensions.ts";
import { analyzeUnderConstrainedVisualization } from "../../sketch/constraints/UnderConstrainedViz.ts";
import type { Point2D } from "../../sketch/geometry/Point2D.ts";
import type { ConstraintReference } from "../../sketch/model/Constraint.ts";
import { isDrivingConstraint } from "../../sketch/model/Constraint.ts";
import type { Sketch } from "../../sketch/model/Sketch.ts";
import type { SelectionState } from "../../sketch/selection/SelectionManager.ts";
import type { SnapCandidate } from "../../sketch/selection/SnapEngine.ts";
import type { ConstraintCreateRequest } from "../../sketch/commands/AddMaintainedConstraintCommand.ts";
import {
  isConstraintPickTool,
  type ActiveTool,
} from "../../sketch/tools/ActiveTool.ts";
import type {
  LineMetrics,
  PointDragState,
  RectMetrics,
} from "../../sketch/tools/ToolTypes.ts";
import { toolHint } from "../../sketch/tools/ToolTypes.ts";
import type { TrimExtendRequest } from "../../sketch/tools/TrimExtendTool.ts";
import type { MirrorRequest } from "../../sketch/tools/MirrorTool.ts";
import type { FilletChamferRequest } from "../../sketch/tools/FilletChamferTool.ts";
import { panCamera, screenToWorld } from "../../sketch/viewport/Camera.ts";
import { hitTestDimensionLabel } from "../../sketch/viewport/dimensionHitTest.ts";
import { chooseGridSpacing } from "../../sketch/viewport/Grid.ts";
import { renderViewport } from "../../sketch/viewport/renderViewport.ts";
import { DimensionCanvasEditor } from "./DimensionCanvasEditor.tsx";
import {
  applyToolResult,
  type ToolResultCallbacks,
  type ToolResultLocalState,
} from "./applyToolResult.ts";
import {
  getCanvasPoint,
  isPanButton,
  isPrimaryButton,
  modifiersFromEvent,
  toolClassName,
} from "./canvasPointer.ts";
import {
  dispatchToolPointerDown,
  dispatchToolPointerLeave,
  dispatchToolPointerMove,
  dispatchToolPointerUp,
} from "./dispatchActiveTool.ts";
import { useCanvasViewport } from "./useCanvasViewport.ts";
import { useCreationToolSession } from "./useCreationToolSession.ts";

type SketchCanvasProps = {
  readonly sketch: Sketch;
  readonly selection: SelectionState;
  readonly activeTool: ActiveTool;
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
  /** Commit canvas dimension edit text (parsed/validated by App). */
  readonly onCommitDimensionText?: (constraintId: string, text: string) => void;
  readonly onCommitPointMove: (
    target: GeometryDragTarget,
    from: Point2D,
    to: Point2D,
  ) => void;
  readonly onCursorWorldChange?: (point: Point2D | null) => void;
  readonly onSnapChange?: (snap: SnapCandidate | null) => void;
  readonly onLineMetricsChange?: (metrics: LineMetrics | null) => void;
  readonly onRectMetricsChange?: (metrics: RectMetrics | null) => void;
  readonly onCircleRadiusChange?: (radiusMm: number | null) => void;
  readonly onArcSweepChange?: (sweepDegrees: number | null) => void;
  readonly onCreationSessionChange?: (active: boolean) => void;
  /** Scale only — pan must not re-render App. */
  readonly onCameraScaleChange?: (scale: number) => void;
  /** Incremented by App when Escape should cancel an in-progress creation. */
  readonly creationCancelRequest?: number;
  readonly onCreationCancelled?: () => void;
};

function isCreationTool(activeTool: ActiveTool): boolean {
  return (
    activeTool === "point" ||
    activeTool === "line" ||
    activeTool === "rectangle" ||
    activeTool === "circle" ||
    activeTool === "arc" ||
    activeTool === "trim" ||
    activeTool === "extend" ||
    activeTool === "mirror" ||
    activeTool === "fillet" ||
    activeTool === "chamfer" ||
    activeTool === "coincident" ||
    isConstraintPickTool(activeTool)
  );
}

export const SketchCanvas = memo(function SketchCanvas({
  sketch,
  selection,
  activeTool,
  onSelectionChange,
  onCreatePoint,
  onCreateLine,
  onCreateRectangle,
  onCreateCircle,
  onCreateArc,
  onCreateCoincident,
  onCreateConstraint,
  onTrim,
  onExtend,
  onMirror,
  onFillet,
  onChamfer,
  onCommitDimensionText,
  onCommitPointMove,
  onCursorWorldChange,
  onSnapChange,
  onLineMetricsChange,
  onRectMetricsChange,
  onCircleRadiusChange,
  onArcSweepChange,
  onCreationSessionChange,
  onCameraScaleChange,
  creationCancelRequest = 0,
  onCreationCancelled,
}: SketchCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<PointDragState | null>(null);
  const [isDraggingPoint, setIsDraggingPoint] = useState(false);
  const [dragPreview, setDragPreview] = useState<PointDragState | null>(null);
  const [dimensionEdit, setDimensionEdit] = useState<{
    readonly constraintId: string;
    readonly left: number;
    readonly top: number;
    readonly initial: string;
    readonly unitLabel: string;
  } | null>(null);

  const { size, camera, setCamera, isPanning, setIsPanning, panRef } =
    useCanvasViewport(canvasRef, onCameraScaleChange);

  const {
    toolRefs,
    previewPoint,
    setPreviewPoint,
    previewLine,
    setPreviewLine,
    previewRectangle,
    setPreviewRectangle,
    previewCircle,
    setPreviewCircle,
    previewArc,
    setPreviewArc,
    activeSnap,
    setActiveSnap,
  } = useCreationToolSession(activeTool, creationCancelRequest, {
    onLineMetricsChange,
    onRectMetricsChange,
    onCircleRadiusChange,
    onArcSweepChange,
    onCreationSessionChange,
    onCreationCancelled,
  });

  const toolCallbacks: ToolResultCallbacks = {
    onSelectionChange,
    onCreatePoint,
    onCreateLine,
    onCreateRectangle,
    onCreateCircle,
    onCreateArc,
    onCreateCoincident,
    onCreateConstraint,
    onTrim,
    onExtend,
    onMirror,
    onFillet,
    onChamfer,
    onCommitPointMove,
    onCursorWorldChange,
    onLineMetricsChange,
    onRectMetricsChange,
    onCircleRadiusChange,
    onArcSweepChange,
    onCreationSessionChange,
  };

  const toolLocal: ToolResultLocalState = {
    dragRef,
    setPreviewPoint,
    setPreviewLine,
    setPreviewRectangle,
    setPreviewCircle,
    setPreviewArc,
    setActiveSnap,
    setDragPreview,
    setIsDraggingPoint,
  };

  const applyResult = (result: Parameters<typeof applyToolResult>[0]) => {
    applyToolResult(result, toolCallbacks, toolLocal);
  };

  useEffect(() => {
    if (isCreationTool(activeTool) || isDraggingPoint) {
      onSnapChange?.(activeSnap);
      return;
    }
    onSnapChange?.(null);
  }, [activeSnap, activeTool, isDraggingPoint, onSnapChange]);

  const displaySketch =
    dragPreview === null
      ? sketch
      : applyGeometryDragWithConstraints(
          sketch,
          dragPreview.target,
          dragPreview.currentPosition,
        );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null || size.width === 0 || size.height === 0) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(size.width * dpr);
    canvas.height = Math.floor(size.height * dpr);

    const context = canvas.getContext("2d");
    if (context === null) {
      return;
    }

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    const showPreview = isCreationTool(activeTool) || isDraggingPoint;
    const freeHandles = analyzeUnderConstrainedVisualization(displaySketch).freeHandles;
    renderViewport(context, {
      camera,
      viewport: size,
      gridVisible: sketch.settings.gridVisible,
      geometry: displaySketch.geometry,
      annotationSketch: displaySketch,
      freeHandles,
      selection,
      previewPoint: isCreationTool(activeTool) ? previewPoint : null,
      previewLine:
        activeTool === "line" || activeTool === "chamfer" ? previewLine : null,
      previewRectangle: activeTool === "rectangle" ? previewRectangle : null,
      previewCircle: activeTool === "circle" ? previewCircle : null,
      previewArc:
        activeTool === "arc" || activeTool === "fillet" ? previewArc : null,
      activeSnap: showPreview ? activeSnap : null,
    });
  }, [
    activeSnap,
    activeTool,
    camera,
    displaySketch,
    isDraggingPoint,
    previewArc,
    previewCircle,
    previewLine,
    previewPoint,
    previewRectangle,
    selection,
    size,
    sketch.settings.gridVisible,
  ]);

  const grid = chooseGridSpacing(camera.scale);

  const pointerContext = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const screenPoint = getCanvasPoint(
      event.currentTarget,
      event.clientX,
      event.clientY,
    );
    return {
      worldPoint: screenToWorld(screenPoint, camera),
      camera,
      sketch,
      selection,
      modifiers: modifiersFromEvent(event),
    };
  };

  return (
    <section className="canvas-pane" aria-label="Sketch canvas">
      <div className="canvas-pane-chrome" aria-hidden="true">
        <span className="canvas-pane-title">2D Sketch</span>
      </div>
      <canvas
        ref={canvasRef}
        className={`sketch-canvas${isPanning ? " is-panning" : ""}${toolClassName(activeTool)}`}
        aria-label="Sketch viewport"
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          if (isPanButton(event)) {
            event.preventDefault();
            panRef.current = {
              pointerId: event.pointerId,
              lastClientX: event.clientX,
              lastClientY: event.clientY,
            };
            setIsPanning(true);
            try {
              event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
              // Synthetic or unsupported pointer ids can reject capture.
            }
            return;
          }

          if (!isPrimaryButton(event)) {
            return;
          }

          const result = dispatchToolPointerDown(
            activeTool,
            pointerContext(event),
            toolRefs,
          );
          applyResult(result);
          if (result.beginPointDrag !== undefined) {
            try {
              event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
              // Synthetic or unsupported pointer ids can reject capture.
            }
          }
        }}
        onPointerMove={(event) => {
          const pan = panRef.current;
          if (pan !== null && pan.pointerId === event.pointerId) {
            const deltaX = event.clientX - pan.lastClientX;
            const deltaY = event.clientY - pan.lastClientY;
            panRef.current = {
              pointerId: pan.pointerId,
              lastClientX: event.clientX,
              lastClientY: event.clientY,
            };
            setCamera((current) => panCamera(current, deltaX, deltaY));
            return;
          }

          const drag =
            dragRef.current !== null && event.buttons !== 0
              ? dragRef.current
              : null;
          applyResult(
            dispatchToolPointerMove(
              activeTool,
              pointerContext(event),
              toolRefs,
              drag,
            ),
          );
        }}
        onPointerUp={(event) => {
          if (panRef.current?.pointerId === event.pointerId) {
            panRef.current = null;
            setIsPanning(false);
          }

          if (dragRef.current !== null) {
            applyResult(dispatchToolPointerUp(dragRef.current));
          }

          try {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
          } catch {
            // Ignore capture release failures for synthetic pointers.
          }
        }}
        onPointerCancel={(event) => {
          if (panRef.current?.pointerId === event.pointerId) {
            panRef.current = null;
            setIsPanning(false);
          }
          if (dragRef.current !== null) {
            dragRef.current = null;
            setDragPreview(null);
            setIsDraggingPoint(false);
            setActiveSnap(null);
          }
        }}
        onPointerLeave={() => {
          if (panRef.current !== null || dragRef.current !== null) {
            return;
          }
          applyResult(
            dispatchToolPointerLeave(activeTool, toolRefs, selection),
          );
        }}
        onDoubleClick={(event) => {
          if (activeTool !== "select" || onCommitDimensionText === undefined) {
            return;
          }
          const canvas = event.currentTarget;
          const screenPoint = getCanvasPoint(
            canvas,
            event.clientX,
            event.clientY,
          );
          const worldPoint = screenToWorld(screenPoint, camera);
          const ctx = canvas.getContext("2d");
          if (ctx === null) {
            return;
          }
          ctx.font = "11px system-ui, sans-serif";
          const hit = hitTestDimensionLabel(
            sketch,
            worldPoint,
            camera,
            (text) => ctx.measureText(text).width,
          );
          if (hit === null) {
            return;
          }
          const constraint = sketch.constraints.find(
            (item) => item.id === hit.constraintId,
          );
          if (
            constraint === undefined ||
            !isSupportedDimensionType(constraint.type) ||
            !isDrivingConstraint(constraint) ||
            constraint.value === undefined
          ) {
            return;
          }
          const isAngle = constraint.type === "angle";
          setDimensionEdit({
            constraintId: constraint.id,
            left: hit.screen.x,
            top: hit.screen.y,
            initial: formatDimensionInputValue(
              constraint.value,
              isAngle ? "angle" : "length",
            ),
            unitLabel: isAngle ? "°" : "mm",
          });
        }}
      />
      {dimensionEdit !== null && (
        <DimensionCanvasEditor
          left={dimensionEdit.left}
          top={dimensionEdit.top}
          initial={dimensionEdit.initial}
          unitLabel={dimensionEdit.unitLabel}
          ariaLabel={`Edit dimension ${dimensionEdit.constraintId}`}
          onCancel={() => setDimensionEdit(null)}
          onCommit={(text) => {
            const id = dimensionEdit.constraintId;
            setDimensionEdit(null);
            onCommitDimensionText?.(id, text);
          }}
        />
      )}
      <p className="canvas-overlay">
        {sketch.geometry.length === 0
          ? `Empty sketch · grid ${grid.minorMm} mm`
          : `${sketch.geometry.length} entities · grid ${grid.minorMm} mm`}
      </p>
      <p className="canvas-hint">{toolHint(activeTool)}</p>
    </section>
  );
});
