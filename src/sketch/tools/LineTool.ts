import { TOLERANCE } from "../geometry/GeometryMath.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import type { SnapCandidate } from "../selection/SnapEngine.ts";
import { midpointSourceFromSnap } from "../constraints/Midpoint.ts";
import {
  cancelTwoClickSession,
  computeLineMetrics,
  snapInContext,
  type LinePreview,
  type ToolPointerContext,
  type ToolPointerResult,
  type TwoClickToolPhase,
} from "./ToolTypes.ts";

export interface LineToolState {
  readonly phase: TwoClickToolPhase;
  readonly start: Point2D | null;
  /** Snap used when the start was placed (for auto midpoint on commit). */
  readonly startSnap: SnapCandidate | null;
}

export function createLineToolState(): LineToolState {
  return {
    phase: "idle",
    start: null,
    startSnap: null,
  };
}

export function handleLineToolPointerDown(
  context: ToolPointerContext,
  state: LineToolState,
): { readonly result: ToolPointerResult; readonly state: LineToolState } {
  if (state.phase === "idle" || state.start === null) {
    const snapped = snapInContext(context);
    return {
      state: {
        phase: "drawing",
        start: snapped.point,
        startSnap: snapped.snap,
      },
      result: {
        previewPoint: snapped.point,
        previewLine: null,
        lineMetrics: null,
        activeSnap: snapped.snap,
        cursorWorld: snapped.point,
        creationSessionActive: true,
      },
    };
  }

  const snapped = snapInContext(context, { alignTo: state.start });
  const preview = buildPreview(state.start, snapped.point, state.startSnap, snapped.snap);
  if (preview === null) {
    return {
      state,
      result: {
        previewPoint: snapped.point,
        previewLine: { start: state.start, end: snapped.point },
        lineMetrics: computeLineMetrics(state.start, snapped.point),
        activeSnap: snapped.snap,
        cursorWorld: snapped.point,
        creationSessionActive: true,
      },
    };
  }

  // Continue drawing from the accepted end. Perfect H/V lines get orientation
  // constraints when the create command commits (see createAddLineCommand).
  // Midpoint snaps create midpoint constraints on the committed segment.
  return {
    state: {
      phase: "drawing",
      start: preview.end,
      startSnap: snapped.snap,
    },
    result: {
      createLine: preview,
      previewPoint: preview.end,
      previewLine: null,
      lineMetrics: null,
      activeSnap: snapped.snap,
      cursorWorld: preview.end,
      creationSessionActive: true,
    },
  };
}

export function handleLineToolPointerMove(
  context: ToolPointerContext,
  state: LineToolState,
): ToolPointerResult {
  if (state.phase === "idle" || state.start === null) {
    const snapped = snapInContext(context);
    return {
      previewPoint: snapped.point,
      previewLine: null,
      lineMetrics: null,
      activeSnap: snapped.snap,
      cursorWorld: snapped.point,
      creationSessionActive: false,
    };
  }

  const snapped = snapInContext(context, { alignTo: state.start });
  const end = snapped.point;

  return {
    previewPoint: end,
    previewLine: { start: state.start, end },
    lineMetrics: computeLineMetrics(state.start, end),
    activeSnap: snapped.snap,
    cursorWorld: end,
    creationSessionActive: true,
  };
}

export function handleLineToolPointerLeave(
  state: LineToolState,
): ToolPointerResult {
  return {
    previewPoint: null,
    previewLine: null,
    lineMetrics: null,
    activeSnap: null,
    cursorWorld: null,
    creationSessionActive: state.phase === "drawing",
  };
}

/** Cancel an in-progress segment; returns whether a segment was cancelled. */
export function cancelLineToolSegment(state: LineToolState): {
  readonly state: LineToolState;
  readonly cancelled: boolean;
} {
  return cancelTwoClickSession(state, createLineToolState);
}

function buildPreview(
  start: Point2D,
  end: Point2D,
  startSnap: SnapCandidate | null,
  endSnap: SnapCandidate | null,
): LinePreview | null {
  const metrics = computeLineMetrics(start, end);
  if (metrics.lengthMm <= TOLERANCE.coincidence) {
    return null;
  }
  const startMidpointOf = midpointSourceFromSnap(startSnap) ?? undefined;
  const endMidpointOf = midpointSourceFromSnap(endSnap) ?? undefined;
  return {
    start,
    end,
    ...(startMidpointOf !== undefined ? { startMidpointOf } : {}),
    ...(endMidpointOf !== undefined ? { endMidpointOf } : {}),
  };
}
