import { useEffect, useRef, useState } from "react";
import type { Point2D } from "../../sketch/geometry/Point2D.ts";
import type { SnapCandidate } from "../../sketch/selection/SnapEngine.ts";
import {
  isConstraintPickTool,
  type ActiveTool,
} from "../../sketch/tools/ActiveTool.ts";
import {
  cancelConstraintPickToolSession,
  createConstraintPickToolState,
  type ConstraintPickToolState,
} from "../../sketch/tools/ConstraintPickTool.ts";
import {
  cancelArcToolSession,
  createArcToolState,
  type ArcToolState,
} from "../../sketch/tools/ArcTool.ts";
import {
  cancelArc3ToolSession,
  createArc3ToolState,
  type Arc3ToolState,
} from "../../sketch/tools/Arc3Tool.ts";
import {
  cancelArcTangentToolSession,
  createArcTangentToolState,
  type ArcTangentToolState,
} from "../../sketch/tools/ArcTangentTool.ts";
import {
  cancelCircleToolSession,
  createCircleToolState,
  type CircleToolState,
} from "../../sketch/tools/CircleTool.ts";
import {
  cancelCoincidentToolSession,
  createCoincidentToolState,
  type CoincidentToolState,
} from "../../sketch/tools/CoincidentTool.ts";
import {
  cancelFilletChamferToolSession,
  createFilletChamferToolState,
  type FilletChamferToolState,
} from "../../sketch/tools/FilletChamferTool.ts";
import {
  cancelLineToolSegment,
  createLineToolState,
  type LineToolState,
} from "../../sketch/tools/LineTool.ts";
import {
  cancelOffsetToolSession,
  createOffsetToolState,
  type OffsetToolState,
} from "../../sketch/tools/OffsetTool.ts";
import {
  cancelPolygonToolSession,
  createPolygonToolState,
  type PolygonToolState,
} from "../../sketch/tools/PolygonTool.ts";
import {
  cancelRectangleToolSession,
  createRectangleToolState,
  type RectangleToolState,
} from "../../sketch/tools/RectangleTool.ts";
import {
  cancelSlotToolSession,
  createSlotToolState,
  type SlotToolState,
} from "../../sketch/tools/SlotTool.ts";
import type {
  ArcPreview,
  CirclePreview,
  LinePreview,
  PolylinePreview,
  RectanglePreview,
} from "../../sketch/tools/ToolTypes.ts";
import type { CreationChromeCallbacks } from "./applyToolResult.ts";
import type { CreationToolRefs } from "./dispatchActiveTool.ts";

export function useCreationToolSession(
  activeTool: ActiveTool,
  creationCancelRequest: number,
  callbacks: CreationChromeCallbacks,
) {
  const lineToolRef = useRef<LineToolState>(createLineToolState());
  const rectangleToolRef = useRef<RectangleToolState>(createRectangleToolState());
  const polygonToolRef = useRef<PolygonToolState>(createPolygonToolState());
  const slotToolRef = useRef<SlotToolState>(createSlotToolState());
  const circleToolRef = useRef<CircleToolState>(createCircleToolState());
  const arcToolRef = useRef<ArcToolState>(createArcToolState());
  const arc3ToolRef = useRef<Arc3ToolState>(createArc3ToolState());
  const arcTangentToolRef = useRef<ArcTangentToolState>(
    createArcTangentToolState(),
  );
  const offsetToolRef = useRef<OffsetToolState>(createOffsetToolState());
  const coincidentToolRef = useRef<CoincidentToolState>(createCoincidentToolState());
  const constraintPickToolRef = useRef<ConstraintPickToolState>(
    createConstraintPickToolState(),
  );
  const filletChamferToolRef = useRef<FilletChamferToolState>(
    createFilletChamferToolState(),
  );
  const lastCreationCancelRef = useRef(0);

  const [previewPoint, setPreviewPoint] = useState<Point2D | null>(null);
  const [previewLine, setPreviewLine] = useState<LinePreview | null>(null);
  const [previewRectangle, setPreviewRectangle] =
    useState<RectanglePreview | null>(null);
  const [previewCircle, setPreviewCircle] = useState<CirclePreview | null>(null);
  const [previewArc, setPreviewArc] = useState<ArcPreview | null>(null);
  const [previewPolyline, setPreviewPolyline] =
    useState<PolylinePreview | null>(null);
  const [activeSnap, setActiveSnap] = useState<SnapCandidate | null>(null);

  const clearCreationPreview = () => {
    setPreviewPoint(null);
    setPreviewLine(null);
    setPreviewRectangle(null);
    setPreviewCircle(null);
    setPreviewArc(null);
    setPreviewPolyline(null);
    setActiveSnap(null);
    callbacks.onLineMetricsChange?.(null);
    callbacks.onRectMetricsChange?.(null);
    callbacks.onCircleRadiusChange?.(null);
    callbacks.onArcSweepChange?.(null);
    callbacks.onPolygonSidesChange?.(null);
    callbacks.onCreationSessionChange?.(false);
  };

  useEffect(() => {
    lineToolRef.current = createLineToolState();
    rectangleToolRef.current = createRectangleToolState();
    polygonToolRef.current = createPolygonToolState();
    slotToolRef.current = createSlotToolState();
    circleToolRef.current = createCircleToolState();
    arcToolRef.current = createArcToolState();
    arc3ToolRef.current = createArc3ToolState();
    arcTangentToolRef.current = createArcTangentToolState();
    offsetToolRef.current = createOffsetToolState();
    coincidentToolRef.current = createCoincidentToolState();
    constraintPickToolRef.current = createConstraintPickToolState();
    filletChamferToolRef.current = createFilletChamferToolState();
    clearCreationPreview();
    if (activeTool === "polygon") {
      callbacks.onPolygonSidesChange?.(polygonToolRef.current.sides);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [activeTool]);

  useEffect(() => {
    if (creationCancelRequest === lastCreationCancelRef.current) {
      return;
    }
    lastCreationCancelRef.current = creationCancelRequest;

    let cancelled = false;
    if (activeTool === "line") {
      const result = cancelLineToolSegment(lineToolRef.current);
      lineToolRef.current = result.state;
      cancelled = result.cancelled;
    } else if (activeTool === "rectangle") {
      const result = cancelRectangleToolSession(rectangleToolRef.current);
      rectangleToolRef.current = result.state;
      cancelled = result.cancelled;
    } else if (activeTool === "polygon") {
      const result = cancelPolygonToolSession(polygonToolRef.current);
      polygonToolRef.current = result.state;
      cancelled = result.cancelled;
    } else if (activeTool === "slot") {
      const result = cancelSlotToolSession(slotToolRef.current);
      slotToolRef.current = result.state;
      cancelled = result.cancelled;
    } else if (activeTool === "circle") {
      const result = cancelCircleToolSession(circleToolRef.current);
      circleToolRef.current = result.state;
      cancelled = result.cancelled;
    } else if (activeTool === "arc") {
      const result = cancelArcToolSession(arcToolRef.current);
      arcToolRef.current = result.state;
      cancelled = result.cancelled;
    } else if (activeTool === "arc3") {
      const result = cancelArc3ToolSession(arc3ToolRef.current);
      arc3ToolRef.current = result.state;
      cancelled = result.cancelled;
    } else if (activeTool === "arcTangent") {
      const result = cancelArcTangentToolSession(arcTangentToolRef.current);
      arcTangentToolRef.current = result.state;
      cancelled = result.cancelled;
    } else if (activeTool === "offset") {
      const result = cancelOffsetToolSession(offsetToolRef.current);
      offsetToolRef.current = result.state;
      cancelled = result.cancelled;
    } else if (activeTool === "coincident") {
      const result = cancelCoincidentToolSession(coincidentToolRef.current);
      coincidentToolRef.current = result.state;
      cancelled = result.cancelled;
    } else if (isConstraintPickTool(activeTool)) {
      const result = cancelConstraintPickToolSession(constraintPickToolRef.current);
      constraintPickToolRef.current = result.state;
      cancelled = result.cancelled;
    } else if (activeTool === "fillet" || activeTool === "chamfer") {
      const result = cancelFilletChamferToolSession(filletChamferToolRef.current);
      filletChamferToolRef.current = result.state;
      cancelled = result.cancelled;
    }

    clearCreationPreview();
    if (cancelled) {
      callbacks.onCreationCancelled?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [creationCancelRequest]);

  const toolRefs: CreationToolRefs = {
    lineToolRef,
    rectangleToolRef,
    polygonToolRef,
    slotToolRef,
    circleToolRef,
    arcToolRef,
    arc3ToolRef,
    arcTangentToolRef,
    offsetToolRef,
    coincidentToolRef,
    constraintPickToolRef,
    filletChamferToolRef,
  };

  return {
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
  };
}
