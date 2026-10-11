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
  OffsetSegment,
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
import {
  adjustPolygonSides,
  handlePolygonToolPointerMove,
} from "../../sketch/tools/PolygonTool.ts";

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
  readonly onCreateRectangle: (
    cornerA: Point2D,
    cornerB: Point2D,
    options?: {
      readonly cornerASnap?: SnapCandidate | null;
      readonly cornerBSnap?: SnapCandidate | null;
    },
  ) => void;
  readonly onCreateCircle: (
    center: Point2D,
    radiusPoint: Point2D,
    options?: {
      readonly centerMidpointOf?: string;
      readonly centerSnap?: SnapCandidate | null;
    },
  ) => void;
  readonly onCreateArc: (
    center: Point2D,
    startPoint: Point2D,
    endPoint: Point2D,
  ) => void;
  readonly onCreatePolygon: (
    center: Point2D,
    radiusPoint: Point2D,
    sides: number,
  ) => void;
  readonly onCreateOffsetSegments: (
    segments: readonly OffsetSegment[],
  ) => void;
  readonly onCreateSlot: (
    centerA: Point2D,
    centerB: Point2D,
    halfWidth: number,
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
  readonly onPolygonSidesChange?: (sides: number | null) => void;
  readonly onCreationSessionChange?: (active: boolean) => void;
  /** Scale only — pan must not re-render App. */
  readonly onCameraScaleChange?: (scale: number) => void;
  /** Incremented by App when Escape should cancel an in-progress creation. */
  readonly creationCancelRequest?: number;
  readonly onCreationCancelled?: () => void;
  /**
   * When `seq` increments while Polygon is active, adjust side count by `delta`
   * ([ / ] / toolbar steppers).
   */
  readonly polygonSidesNudge?: { readonly seq: number; readonly delta: number };
};

function isCreationTool(activeTool: ActiveTool): boolean {
  return (
    activeTool === "point" ||
    activeTool === "line" ||
    activeTool === "rectangle" ||
    activeTool === "polygon" ||
    activeTool === "slot" ||
    activeTool === "circle" ||
    activeTool === "arc" ||
    activeTool === "arc3" ||
    activeTool === "arcTangent" ||
    activeTool === "trim" ||
    activeTool === "extend" ||
    activeTool === "offset" ||
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
  onCreatePolygon,
  onCreateOffsetSegments,
  onCreateSlot,
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
  onPolygonSidesChange,
  onCreationSessionChange,
  onCameraScaleChange,
  creationCancelRequest = 0,
  onCreationCancelled,
  polygonSidesNudge,
}: SketchCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPolygonNudgeSeqRef = useRef(0);
  const lastCursorWorldRef = useRef<Point2D | null>(null);
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
    previewPolyline,
    setPreviewPolyline,
    activeSnap,
    setActiveSnap,
  } = useCreationToolSession(activeTool, creationCancelRequest, {
    onLineMetricsChange,
    onRectMetricsChange,
    onCircleRadiusChange,
    onArcSweepChange,
    onPolygonSidesChange,
    onCreationSessionChange,
    onCreationCancelled,
  });

  const toolCallbacks: ToolResultCallbacks = {
    onSelectionChange,
    onCreatePoint,
    onCreateLine,
    onCreateRectangle,
    onCreateCircle,
    onCreatePolygon,
    onCreateOffsetSegments,
    onCreateSlot,
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
    onPolygonSidesChange,
    onCreationSessionChange,
  };

  const toolLocal: ToolResultLocalState = {
    dragRef,
    setPreviewPoint,
    setPreviewLine,
    setPreviewRectangle,
    setPreviewCircle,
    setPreviewArc,
    setPreviewPolyline,
    setActiveSnap,
    setDragPreview,
    setIsDraggingPoint,
  };

  const applyResult = (result: Parameters<typeof applyToolResult>[0]) => {
    applyToolResult(result, toolCallbacks, toolLocal);
  };

  const clearPointDrag = () => {
    if (dragRef.current === null && !isDraggingPoint) {
      return;
    }
    dragRef.current = null;
    setDragPreview(null);
    setIsDraggingPoint(false);
    setActiveSnap(null);
  };

  // Escape / tool change must discard in-progress select drag without committing.
  useEffect(() => {
    if (!isDraggingPoint) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      clearPointDrag();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clearPointDrag reads latest drag refs
  }, [isDraggingPoint]);

  useEffect(() => {
    clearPointDrag();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- abort drag when leaving Select or switching tools
  }, [activeTool]);

  useEffect(() => {
    if (isCreationTool(activeTool) || isDraggingPoint) {
      onSnapChange?.(activeSnap);
      return;
    }
    onSnapChange?.(null);
  }, [activeSnap, activeTool, isDraggingPoint, onSnapChange]);

  useEffect(() => {
    if (polygonSidesNudge === undefined) {
      return;
    }
    if (polygonSidesNudge.seq === lastPolygonNudgeSeqRef.current) {
      return;
    }
    lastPolygonNudgeSeqRef.current = polygonSidesNudge.seq;
    if (activeTool !== "polygon" || polygonSidesNudge.delta === 0) {
      return;
    }
    toolRefs.polygonToolRef.current = adjustPolygonSides(
      toolRefs.polygonToolRef.current,
      polygonSidesNudge.delta,
    );
    onPolygonSidesChange?.(toolRefs.polygonToolRef.current.sides);
    const cursor = lastCursorWorldRef.current;
    if (cursor !== null && toolRefs.polygonToolRef.current.phase === "drawing") {
      applyResult(
        handlePolygonToolPointerMove(
          {
            worldPoint: cursor,
            camera,
            sketch,
            selection,
            modifiers: { shift: false, ctrl: false, meta: false },
          },
          toolRefs.polygonToolRef.current,
        ),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nudge seq drives refresh
  }, [polygonSidesNudge, activeTool]);

  useEffect(() => {
    if (activeTool !== "polygon") {
      return;
    }
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
      let delta = 0;
      if (event.key === "[" || event.key === "-") {
        delta = -1;
      } else if (event.key === "]" || event.key === "+" || event.key === "=") {
        delta = 1;
      }
      if (delta === 0) {
        return;
      }
      event.preventDefault();
      toolRefs.polygonToolRef.current = adjustPolygonSides(
        toolRefs.polygonToolRef.current,
        delta,
      );
      onPolygonSidesChange?.(toolRefs.polygonToolRef.current.sides);
      const cursor = lastCursorWorldRef.current;
      if (
        cursor !== null &&
        toolRefs.polygonToolRef.current.phase === "drawing"
      ) {
        applyResult(
          handlePolygonToolPointerMove(
            {
              worldPoint: cursor,
              camera,
              sketch,
              selection,
              modifiers: { shift: false, ctrl: false, meta: false },
            },
            toolRefs.polygonToolRef.current,
          ),
        );
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tool session keys
  }, [activeTool, camera, sketch, selection, onPolygonSidesChange]);

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
    const underConstrained = analyzeUnderConstrainedVisualization(displaySketch);
    renderViewport(context, {
      camera,
      viewport: size,
      gridVisible: sketch.settings.gridVisible,
      geometry: displaySketch.geometry,
      annotationSketch: displaySketch,
      freeHandles: underConstrained.freeHandles,
      fullyConstrainedIds: underConstrained.fullyConstrainedEntityIds,
      selection,
      previewPoint: isCreationTool(activeTool) ? previewPoint : null,
      previewLine:
        activeTool === "line" ||
        activeTool === "chamfer" ||
        activeTool === "offset"
          ? previewLine
          : null,
      previewRectangle: activeTool === "rectangle" ? previewRectangle : null,
      previewCircle:
        activeTool === "circle" ||
        activeTool === "polygon" ||
        activeTool === "offset"
          ? previewCircle
          : null,
      previewArc:
        activeTool === "arc" ||
        activeTool === "arc3" ||
        activeTool === "arcTangent" ||
        activeTool === "slot" ||
        activeTool === "fillet"
          ? previewArc
          : null,
      previewPolyline: activeTool === "offset" ? previewPolyline : null,
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
    previewPolyline,
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
    const worldPoint = screenToWorld(screenPoint, camera);
    lastCursorWorldRef.current = worldPoint;
    return {
      worldPoint,
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

          // Once a point drag is active (pointer capture), keep updating even if
          // the browser omits buttons on some move events (seen in automation).
          const drag = dragRef.current;
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
          clearPointDrag();
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
