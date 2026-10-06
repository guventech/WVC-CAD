import {
  axisAlignedCornersFromDiagonal,
  rectangleMetrics,
} from "../geometry/RectangleMath.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import {
  cancelTwoClickSession,
  snapInContext,
  type RectMetrics,
  type RectanglePreview,
  type ToolPointerContext,
  type ToolPointerResult,
  type TwoClickToolPhase,
} from "./ToolTypes.ts";

export interface RectangleToolState {
  readonly phase: TwoClickToolPhase;
  readonly cornerA: Point2D | null;
}

export function createRectangleToolState(): RectangleToolState {
  return {
    phase: "idle",
    cornerA: null,
  };
}

export function handleRectangleToolPointerDown(
  context: ToolPointerContext,
  state: RectangleToolState,
): { readonly result: ToolPointerResult; readonly state: RectangleToolState } {
  if (state.phase === "idle" || state.cornerA === null) {
    // First corner: no H/V alignTo (that would collapse the rectangle).
    const snapped = snapInContext(context);
    return {
      state: {
        phase: "drawing",
        cornerA: snapped.point,
      },
      result: {
        previewPoint: snapped.point,
        previewRectangle: null,
        rectMetrics: null,
        activeSnap: snapped.snap,
        cursorWorld: snapped.point,
        creationSessionActive: true,
      },
    };
  }

  const snapped = snapInContext(context);
  const corners = axisAlignedCornersFromDiagonal(state.cornerA, snapped.point);
  if (corners === null) {
    return {
      state,
      result: {
        previewPoint: snapped.point,
        previewRectangle: {
          cornerA: state.cornerA,
          cornerB: snapped.point,
        },
        rectMetrics: degenerateMetrics(state.cornerA, snapped.point),
        activeSnap: snapped.snap,
        cursorWorld: snapped.point,
        creationSessionActive: true,
      },
    };
  }

  return {
    state: createRectangleToolState(),
    result: {
      createRectangle: {
        cornerA: state.cornerA,
        cornerB: snapped.point,
      },
      previewPoint: null,
      previewRectangle: null,
      rectMetrics: null,
      activeSnap: snapped.snap,
      cursorWorld: snapped.point,
      creationSessionActive: false,
    },
  };
}

export function handleRectangleToolPointerMove(
  context: ToolPointerContext,
  state: RectangleToolState,
): ToolPointerResult {
  if (state.phase === "idle" || state.cornerA === null) {
    const snapped = snapInContext(context);
    return {
      previewPoint: snapped.point,
      previewRectangle: null,
      rectMetrics: null,
      activeSnap: snapped.snap,
      cursorWorld: snapped.point,
      creationSessionActive: false,
    };
  }

  const snapped = snapInContext(context);
  const preview: RectanglePreview = {
    cornerA: state.cornerA,
    cornerB: snapped.point,
  };
  const corners = axisAlignedCornersFromDiagonal(state.cornerA, snapped.point);

  return {
    previewPoint: snapped.point,
    previewRectangle: preview,
    rectMetrics:
      corners === null
        ? degenerateMetrics(state.cornerA, snapped.point)
        : rectangleMetrics(corners),
    activeSnap: snapped.snap,
    cursorWorld: snapped.point,
    creationSessionActive: true,
  };
}

export function handleRectangleToolPointerLeave(
  state: RectangleToolState,
): ToolPointerResult {
  return {
    previewPoint: null,
    previewRectangle: null,
    rectMetrics: null,
    activeSnap: null,
    cursorWorld: null,
    creationSessionActive: state.phase === "drawing",
  };
}

export function cancelRectangleToolSession(state: RectangleToolState): {
  readonly state: RectangleToolState;
  readonly cancelled: boolean;
} {
  return cancelTwoClickSession(state, createRectangleToolState);
}

function degenerateMetrics(a: Point2D, b: Point2D): RectMetrics {
  return {
    widthMm: Math.abs(b.x - a.x),
    heightMm: Math.abs(b.y - a.y),
  };
}
