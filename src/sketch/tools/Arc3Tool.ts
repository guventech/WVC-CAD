import {
  angleFromTo,
  arcSweepRadians,
  distance,
  isApproximatelyEqual,
  normalizeAngle,
  TOLERANCE,
} from "../geometry/GeometryMath.ts";
import { circleFromThreePoints } from "../geometry/CircleFromPoints.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import {
  snapInContext,
  type ArcPreview,
  type ToolPointerContext,
  type ToolPointerResult,
} from "./ToolTypes.ts";

export type Arc3ToolPhase = "idle" | "firstSet" | "secondSet";

export interface Arc3ToolState {
  readonly phase: Arc3ToolPhase;
  readonly first: Point2D | null;
  readonly second: Point2D | null;
}

export function createArc3ToolState(): Arc3ToolState {
  return {
    phase: "idle",
    first: null,
    second: null,
  };
}

export function handleArc3ToolPointerDown(
  context: ToolPointerContext,
  state: Arc3ToolState,
): { readonly result: ToolPointerResult; readonly state: Arc3ToolState } {
  if (state.phase === "idle" || state.first === null) {
    const snapped = snapInContext(context);
    return {
      state: {
        phase: "firstSet",
        first: snapped.point,
        second: null,
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

  if (state.phase === "firstSet" || state.second === null) {
    const snapped = snapInContext(context, { alignTo: state.first });
    if (distance(state.first, snapped.point) <= TOLERANCE.coincidence) {
      return {
        state,
        result: sessionPreview(state.first, null, snapped.point, snapped.snap),
      };
    }
    return {
      state: {
        phase: "secondSet",
        first: state.first,
        second: snapped.point,
      },
      result: sessionPreview(
        state.first,
        snapped.point,
        snapped.point,
        snapped.snap,
      ),
    };
  }

  const snapped = snapInContext(context);
  const built = buildThreePointArc(state.first, state.second, snapped.point);
  if (built === null) {
    return {
      state,
      result: sessionPreview(
        state.first,
        state.second,
        snapped.point,
        snapped.snap,
      ),
    };
  }

  return {
    state: createArc3ToolState(),
    result: {
      createArc: {
        center: built.preview.center,
        startPoint: built.startPoint,
        endPoint: built.endPoint,
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

export function handleArc3ToolPointerMove(
  context: ToolPointerContext,
  state: Arc3ToolState,
): ToolPointerResult {
  if (state.phase === "idle" || state.first === null) {
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

  if (state.phase === "firstSet" || state.second === null) {
    const snapped = snapInContext(context, { alignTo: state.first });
    return sessionPreview(state.first, null, snapped.point, snapped.snap);
  }

  const snapped = snapInContext(context);
  return sessionPreview(state.first, state.second, snapped.point, snapped.snap);
}

export function handleArc3ToolPointerLeave(
  state: Arc3ToolState,
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

export function cancelArc3ToolSession(state: Arc3ToolState): {
  readonly state: Arc3ToolState;
  readonly cancelled: boolean;
} {
  if (state.phase !== "idle") {
    return {
      state: createArc3ToolState(),
      cancelled: true,
    };
  }
  return {
    state,
    cancelled: false,
  };
}

export function buildThreePointArc(
  first: Point2D,
  second: Point2D,
  third: Point2D,
): {
  readonly preview: ArcPreview;
  readonly startPoint: Point2D;
  readonly endPoint: Point2D;
} | null {
  const circle = circleFromThreePoints(first, second, third);
  if (circle === null) {
    return null;
  }
  const startAngle = angleFromTo(circle.center, first);
  const midAngle = angleFromTo(circle.center, second);
  const endAngle = angleFromTo(circle.center, third);

  if (angleOnCcwSweep(midAngle, startAngle, endAngle)) {
    return {
      preview: {
        center: circle.center,
        radius: circle.radius,
        startAngle: normalizeAngle(startAngle),
        endAngle: normalizeAngle(endAngle),
        showFullCircleGuide: false,
      },
      startPoint: first,
      endPoint: third,
    };
  }

  // Mid lies on the opposite sweep: store CCW from third → first.
  return {
    preview: {
      center: circle.center,
      radius: circle.radius,
      startAngle: normalizeAngle(endAngle),
      endAngle: normalizeAngle(startAngle),
      showFullCircleGuide: false,
    },
    startPoint: third,
    endPoint: first,
  };
}

function angleOnCcwSweep(angle: number, start: number, end: number): boolean {
  const a = normalizeAngle(angle);
  const s = normalizeAngle(start);
  const e = normalizeAngle(end);
  if (isApproximatelyEqual(s, e, TOLERANCE.geometric)) {
    return true;
  }
  if (s < e) {
    return a >= s - TOLERANCE.geometric && a <= e + TOLERANCE.geometric;
  }
  return a >= s - TOLERANCE.geometric || a <= e + TOLERANCE.geometric;
}

function sessionPreview(
  first: Point2D,
  second: Point2D | null,
  cursor: Point2D,
  snap: ToolPointerResult["activeSnap"],
): ToolPointerResult {
  if (second === null) {
    return {
      previewPoint: cursor,
      previewArc: null,
      circleRadiusMm: null,
      arcSweepDegrees: null,
      activeSnap: snap,
      cursorWorld: cursor,
      creationSessionActive: true,
    };
  }
  const built = buildThreePointArc(first, second, cursor);
  if (built === null) {
    return {
      previewPoint: cursor,
      previewArc: null,
      circleRadiusMm: null,
      arcSweepDegrees: null,
      activeSnap: snap,
      cursorWorld: cursor,
      creationSessionActive: true,
    };
  }
  return {
    previewPoint: cursor,
    previewArc: built.preview,
    circleRadiusMm: built.preview.radius,
    arcSweepDegrees:
      (arcSweepRadians(built.preview.startAngle, built.preview.endAngle) *
        180) /
      Math.PI,
    activeSnap: snap,
    cursorWorld: cursor,
    creationSessionActive: true,
  };
}
