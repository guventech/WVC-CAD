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
  cancelRectangleToolSession,
  createRectangleToolState,
  type RectangleToolState,
} from "../../sketch/tools/RectangleTool.ts";
import type {
  ArcPreview,
  CirclePreview,
  LinePreview,
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
  const circleToolRef = useRef<CircleToolState>(createCircleToolState());
  const arcToolRef = useRef<ArcToolState>(createArcToolState());
  const arc3ToolRef = useRef<Arc3ToolState>(createArc3ToolState());
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
  const [activeSnap, setActiveSnap] = useState<SnapCandidate | null>(null);

  const clearCreationPreview = () => {
    setPreviewPoint(null);
    setPreviewLine(null);
    setPreviewRectangle(null);
    setPreviewCircle(null);
    setPreviewArc(null);
    setActiveSnap(null);
    callbacks.onLineMetricsChange?.(null);
    callbacks.onRectMetricsChange?.(null);
    callbacks.onCircleRadiusChange?.(null);
    callbacks.onArcSweepChange?.(null);
    callbacks.onCreationSessionChange?.(false);
  };

  useEffect(() => {
    lineToolRef.current = createLineToolState();
    rectangleToolRef.current = createRectangleToolState();
    circleToolRef.current = createCircleToolState();
    arcToolRef.current = createArcToolState();
    arc3ToolRef.current = createArc3ToolState();
    coincidentToolRef.current = createCoincidentToolState();
    constraintPickToolRef.current = createConstraintPickToolState();
    filletChamferToolRef.current = createFilletChamferToolState();
    clearCreationPreview();
    // Only reset when the active tool changes — not when parent callbacks are recreated.
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
    circleToolRef,
    arcToolRef,
    arc3ToolRef,
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
    activeSnap,
    setActiveSnap,
  };
}
