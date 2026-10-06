import {
  angleFromTo,
  arcSweepRadians,
  distance,
  isApproximatelyEqual,
  normalizeAngle,
  TOLERANCE,
} from "../geometry/GeometryMath.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import {
  snapInContext,
  type ArcPreview,
  type ToolPointerContext,
  type ToolPointerResult,
} from "./ToolTypes.ts";

export type ArcToolPhase = "idle" | "centerSet" | "startSet";

export interface ArcToolState {
  readonly phase: ArcToolPhase;
  readonly center: Point2D | null;
  readonly start: Point2D | null;
}

export function createArcToolState(): ArcToolState {
  return {
    phase: "idle",
    center: null,
    start: null,
  };
}

export function handleArcToolPointerDown(
  context: ToolPointerContext,
  state: ArcToolState,
): { readonly result: ToolPointerResult; readonly state: ArcToolState } {
  if (state.phase === "idle" || state.center === null) {
    const snapped = snapInContext(context);
    return {
      state: {
        phase: "centerSet",
        center: snapped.point,
        start: null,
      },
      result: {
        previewPoint: snapped.point,
        previewArc: null,
        circleRadiusMm: null,
        arcSweepDegrees: null,
        activeSnap: snapped.snap,
        cursorWorld: snapped.point,
        creationSessionActive: true,
      },
    };
  }

  if (state.phase === "centerSet" || state.start === null) {
    const snapped = snapInContext(context, { alignTo: state.center });
    const radius = distance(state.center, snapped.point);
    if (radius <= TOLERANCE.coincidence) {
      return {
        state,
        result: sessionPreview(state.center, snapped.point, null, snapped.snap),
      };
    }

    return {
      state: {
        phase: "startSet",
        center: state.center,
        start: snapped.point,
      },
      result: sessionPreview(state.center, snapped.point, snapped.point, snapped.snap),
    };
  }

  // End point: angle only; radius fixed from start. alignTo center for H/V·grid.
  const snapped = snapInContext(context, { alignTo: state.center });
  if (!canCommitArc(state.center, state.start, snapped.point)) {
    return {
      state,
      result: sessionPreview(state.center, state.start, snapped.point, snapped.snap),
    };
  }

  return {
    state: createArcToolState(),
    result: {
      createArc: {
        center: state.center,
        startPoint: state.start,
        endPoint: snapped.point,
      },
      previewPoint: null,
      previewArc: null,
      circleRadiusMm: null,
      arcSweepDegrees: null,
      activeSnap: snapped.snap,
      cursorWorld: snapped.point,
      creationSessionActive: false,
    },
  };
}

export function handleArcToolPointerMove(
  context: ToolPointerContext,
  state: ArcToolState,
): ToolPointerResult {
  if (state.phase === "idle" || state.center === null) {
    const snapped = snapInContext(context);
    return {
      previewPoint: snapped.point,
      previewArc: null,
      circleRadiusMm: null,
      arcSweepDegrees: null,
      activeSnap: snapped.snap,
      cursorWorld: snapped.point,
      creationSessionActive: false,
    };
  }

  if (state.phase === "centerSet" || state.start === null) {
    const snapped = snapInContext(context, { alignTo: state.center });
    return sessionPreview(state.center, snapped.point, null, snapped.snap);
  }

  const snapped = snapInContext(context, { alignTo: state.center });
  return sessionPreview(state.center, state.start, snapped.point, snapped.snap);
}

export function handleArcToolPointerLeave(
  state: ArcToolState,
): ToolPointerResult {
  return {
    previewPoint: null,
    previewArc: null,
    circleRadiusMm: null,
    arcSweepDegrees: null,
    activeSnap: null,
    cursorWorld: null,
    creationSessionActive: state.phase !== "idle",
  };
}

export function cancelArcToolSession(state: ArcToolState): {
  readonly state: ArcToolState;
  readonly cancelled: boolean;
} {
  if (state.phase !== "idle") {
    return {
      state: createArcToolState(),
      cancelled: true,
    };
  }
  return {
    state,
    cancelled: false,
  };
}

function sessionPreview(
  center: Point2D,
  startOrRadiusPoint: Point2D,
  endPoint: Point2D | null,
  snap: ToolPointerResult["activeSnap"],
): ToolPointerResult {
  const radius = distance(center, startOrRadiusPoint);
  const preview =
    endPoint === null
      ? radiusPreview(center, startOrRadiusPoint)
      : buildArcPreview(center, startOrRadiusPoint, endPoint);

  return {
    previewPoint: endPoint ?? startOrRadiusPoint,
    previewArc: preview,
    circleRadiusMm: radius,
    arcSweepDegrees:
      preview !== null && endPoint !== null
        ? (arcSweepRadians(preview.startAngle, preview.endAngle) * 180) / Math.PI
        : null,
    activeSnap: snap ?? null,
    cursorWorld: endPoint ?? startOrRadiusPoint,
    creationSessionActive: true,
  };
}

function radiusPreview(center: Point2D, radiusPoint: Point2D): ArcPreview | null {
  const radius = distance(center, radiusPoint);
  if (radius <= TOLERANCE.coincidence) {
    return null;
  }
  const startAngle = angleFromTo(center, radiusPoint);
  return {
    center,
    radius,
    startAngle,
    endAngle: startAngle,
    showFullCircleGuide: true,
  };
}

function buildArcPreview(
  center: Point2D,
  startPoint: Point2D,
  endPoint: Point2D,
): ArcPreview | null {
  const radius = distance(center, startPoint);
  if (radius <= TOLERANCE.coincidence) {
    return null;
  }
  const startAngle = angleFromTo(center, startPoint);
  const endAngle = angleFromTo(center, endPoint);
  const degenerate = isApproximatelyEqual(
    normalizeAngle(startAngle),
    normalizeAngle(endAngle),
    TOLERANCE.geometric,
  );
  return {
    center,
    radius,
    startAngle,
    endAngle: degenerate ? startAngle : endAngle,
    showFullCircleGuide: degenerate,
  };
}

function canCommitArc(
  center: Point2D,
  startPoint: Point2D,
  endPoint: Point2D,
): boolean {
  const radius = distance(center, startPoint);
  if (radius <= TOLERANCE.coincidence) {
    return false;
  }
  return !isApproximatelyEqual(
    normalizeAngle(angleFromTo(center, startPoint)),
    normalizeAngle(angleFromTo(center, endPoint)),
    TOLERANCE.geometric,
  );
}
