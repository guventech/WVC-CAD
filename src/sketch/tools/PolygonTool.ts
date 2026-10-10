import { distance, TOLERANCE } from "../geometry/GeometryMath.ts";
import {
  clampPolygonSides,
  DEFAULT_POLYGON_SIDES,
} from "../geometry/PolygonMath.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import {
  snapInContext,
  type ToolPointerContext,
  type ToolPointerResult,
  type TwoClickToolPhase,
} from "./ToolTypes.ts";

/** Persists across idle resets so wheel/[ ] keep the last N. */
let rememberedPolygonSides = DEFAULT_POLYGON_SIDES;

export interface PolygonToolState {
  readonly phase: TwoClickToolPhase;
  readonly center: Point2D | null;
  readonly sides: number;
}

export function createPolygonToolState(): PolygonToolState {
  return {
    phase: "idle",
    center: null,
    sides: rememberedPolygonSides,
  };
}

export function adjustPolygonSides(
  state: PolygonToolState,
  delta: number,
): PolygonToolState {
  const sides = clampPolygonSides(state.sides + delta);
  rememberedPolygonSides = sides;
  return { ...state, sides };
}

export function setPolygonSides(
  state: PolygonToolState,
  sides: number,
): PolygonToolState {
  const next = clampPolygonSides(sides);
  rememberedPolygonSides = next;
  return { ...state, sides: next };
}

export function handlePolygonToolPointerDown(
  context: ToolPointerContext,
  state: PolygonToolState,
): { readonly result: ToolPointerResult; readonly state: PolygonToolState } {
  if (state.phase === "idle" || state.center === null) {
    const snapped = snapInContext(context);
    return {
      state: { ...state, phase: "drawing", center: snapped.point },
      result: {
        previewPoint: snapped.point,
        previewCircle: null,
        circleRadiusMm: null,
        polygonSides: state.sides,
        activeSnap: snapped.snap,
        cursorWorld: snapped.point,
        creationSessionActive: true,
      },
    };
  }

  const snapped = snapInContext(context, { alignTo: state.center });
  const radius = distance(state.center, snapped.point);
  if (radius <= TOLERANCE.coincidence) {
    return {
      state,
      result: {
        previewPoint: snapped.point,
        previewCircle: {
          center: state.center,
          radiusPoint: snapped.point,
          polygonSides: state.sides,
        },
        circleRadiusMm: radius,
        polygonSides: state.sides,
        activeSnap: snapped.snap,
        cursorWorld: snapped.point,
        creationSessionActive: true,
      },
    };
  }

  return {
    state: { ...createPolygonToolState(), sides: state.sides },
    result: {
      createPolygon: {
        center: state.center,
        radiusPoint: snapped.point,
        sides: state.sides,
      },
      previewPoint: null,
      previewCircle: null,
      circleRadiusMm: null,
      polygonSides: state.sides,
      activeSnap: snapped.snap,
      cursorWorld: snapped.point,
      creationSessionActive: false,
    },
  };
}

export function handlePolygonToolPointerMove(
  context: ToolPointerContext,
  state: PolygonToolState,
): ToolPointerResult {
  if (state.phase === "idle" || state.center === null) {
    const snapped = snapInContext(context);
    return {
      previewPoint: snapped.point,
      previewCircle: null,
      circleRadiusMm: null,
      polygonSides: state.sides,
      activeSnap: snapped.snap,
      cursorWorld: snapped.point,
      creationSessionActive: false,
    };
  }
  const snapped = snapInContext(context, { alignTo: state.center });
  return {
    previewPoint: snapped.point,
    previewCircle: {
      center: state.center,
      radiusPoint: snapped.point,
      polygonSides: state.sides,
    },
    circleRadiusMm: distance(state.center, snapped.point),
    polygonSides: state.sides,
    activeSnap: snapped.snap,
    cursorWorld: snapped.point,
    creationSessionActive: true,
  };
}

export function handlePolygonToolPointerLeave(
  state: PolygonToolState,
): ToolPointerResult {
  return {
    previewPoint: null,
    previewCircle: null,
    circleRadiusMm: null,
    polygonSides: state.sides,
    activeSnap: null,
    cursorWorld: null,
    creationSessionActive: state.phase !== "idle",
  };
}

export function cancelPolygonToolSession(state: PolygonToolState): {
  readonly state: PolygonToolState;
  readonly cancelled: boolean;
} {
  if (state.phase === "drawing") {
    return {
      state: { ...createPolygonToolState(), sides: state.sides },
      cancelled: true,
    };
  }
  return { state, cancelled: false };
}
