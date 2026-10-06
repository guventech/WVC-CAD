import { distance, TOLERANCE } from "../geometry/GeometryMath.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import type { EntityId } from "../model/Geometry.ts";
import type { SnapCandidate } from "../selection/SnapEngine.ts";
import { midpointSourceFromSnap } from "../constraints/Midpoint.ts";
import {
  cancelTwoClickSession,
  snapInContext,
  type CirclePreview,
  type ToolPointerContext,
  type ToolPointerResult,
  type TwoClickToolPhase,
} from "./ToolTypes.ts";

export interface CircleToolState {
  readonly phase: TwoClickToolPhase;
  readonly center: Point2D | null;
  readonly centerSnap: SnapCandidate | null;
}

export function createCircleToolState(): CircleToolState {
  return {
    phase: "idle",
    center: null,
    centerSnap: null,
  };
}

export function handleCircleToolPointerDown(
  context: ToolPointerContext,
  state: CircleToolState,
): { readonly result: ToolPointerResult; readonly state: CircleToolState } {
  if (state.phase === "idle" || state.center === null) {
    const snapped = snapInContext(context);
    return {
      state: {
        phase: "drawing",
        center: snapped.point,
        centerSnap: snapped.snap,
      },
      result: {
        previewPoint: snapped.point,
        previewCircle: null,
        circleRadiusMm: null,
        activeSnap: snapped.snap,
        cursorWorld: snapped.point,
        creationSessionActive: true,
      },
    };
  }

  // Radius tip: alignTo center enables H/V (+ grid compose) without collapsing radius to zero.
  const snapped = snapInContext(context, { alignTo: state.center });
  const radius = distance(state.center, snapped.point);
  if (radius <= TOLERANCE.coincidence) {
    return {
      state,
      result: {
        previewPoint: snapped.point,
        previewCircle: { center: state.center, radiusPoint: snapped.point },
        circleRadiusMm: radius,
        activeSnap: snapped.snap,
        cursorWorld: snapped.point,
        creationSessionActive: true,
      },
    };
  }

  const centerMidpointOf = midpointSourceFromSnap(state.centerSnap);
  return {
    state: createCircleToolState(),
    result: {
      createCircle: circleCreate(
        state.center,
        snapped.point,
        centerMidpointOf,
      ),
      previewPoint: null,
      previewCircle: null,
      circleRadiusMm: null,
      activeSnap: snapped.snap,
      cursorWorld: snapped.point,
      creationSessionActive: false,
    },
  };
}

function circleCreate(
  center: Point2D,
  radiusPoint: Point2D,
  centerMidpointOf: EntityId | null,
): CirclePreview {
  return {
    center,
    radiusPoint,
    ...(centerMidpointOf !== null ? { centerMidpointOf } : {}),
  };
}

export function handleCircleToolPointerMove(
  context: ToolPointerContext,
  state: CircleToolState,
): ToolPointerResult {
  if (state.phase === "idle" || state.center === null) {
    const snapped = snapInContext(context);
    return {
      previewPoint: snapped.point,
      previewCircle: null,
      circleRadiusMm: null,
      activeSnap: snapped.snap,
      cursorWorld: snapped.point,
      creationSessionActive: false,
    };
  }

  const snapped = snapInContext(context, { alignTo: state.center });
  const preview: CirclePreview = {
    center: state.center,
    radiusPoint: snapped.point,
  };

  return {
    previewPoint: snapped.point,
    previewCircle: preview,
    circleRadiusMm: distance(state.center, snapped.point),
    activeSnap: snapped.snap,
    cursorWorld: snapped.point,
    creationSessionActive: true,
  };
}

export function handleCircleToolPointerLeave(
  state: CircleToolState,
): ToolPointerResult {
  return {
    previewPoint: null,
    previewCircle: null,
    circleRadiusMm: null,
    activeSnap: null,
    cursorWorld: null,
    creationSessionActive: state.phase === "drawing",
  };
}

export function cancelCircleToolSession(state: CircleToolState): {
  readonly state: CircleToolState;
  readonly cancelled: boolean;
} {
  return cancelTwoClickSession(state, createCircleToolState);
}
