import { distance, TOLERANCE } from "../geometry/GeometryMath.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import type { EntityId, LineGeometry } from "../model/Geometry.ts";
import { hitTestSketch } from "../selection/HitTesting.ts";
import {
  lineTangentAtNearEnd,
  tangentArcFromStart,
} from "../geometry/TangentArcMath.ts";
import {
  snapInContext,
  type ToolPointerContext,
  type ToolPointerResult,
} from "./ToolTypes.ts";

export type ArcTangentToolPhase = "idle" | "anchorSet";

export interface ArcTangentToolState {
  readonly phase: ArcTangentToolPhase;
  readonly start: Point2D | null;
  readonly tangent: Point2D | null;
  readonly sourceLineId: EntityId | null;
}

export function createArcTangentToolState(): ArcTangentToolState {
  return { phase: "idle", start: null, tangent: null, sourceLineId: null };
}

export function handleArcTangentToolPointerDown(
  context: ToolPointerContext,
  state: ArcTangentToolState,
): { readonly result: ToolPointerResult; readonly state: ArcTangentToolState } {
  if (state.phase === "idle" || state.start === null || state.tangent === null) {
    const anchor = pickLineAnchor(context);
    if (anchor === null) {
      return {
        state,
        result: {
          previewPoint: context.worldPoint,
          previewArc: null,
          activeSnap: null,
          cursorWorld: context.worldPoint,
          creationSessionActive: false,
        },
      };
    }
    return {
      state: {
        phase: "anchorSet",
        start: anchor.point,
        tangent: anchor.tangent,
        sourceLineId: anchor.lineId,
      },
      result: {
        previewPoint: anchor.point,
        previewArc: null,
        activeSnap: null,
        cursorWorld: anchor.point,
        creationSessionActive: true,
      },
    };
  }

  const snapped = snapInContext(context);
  const built = tangentArcFromStart(state.start, state.tangent, snapped.point);
  if (built === null) {
    return {
      state,
      result: {
        previewPoint: snapped.point,
        previewArc: null,
        activeSnap: snapped.snap,
        cursorWorld: snapped.point,
        creationSessionActive: true,
      },
    };
  }

  return {
    state: createArcTangentToolState(),
    result: {
      createArc: {
        center: built.center,
        startPoint: built.startPoint,
        endPoint: built.endPoint,
      },
      previewPoint: null,
      previewArc: null,
      activeSnap: snapped.snap,
      cursorWorld: snapped.point,
      creationSessionActive: false,
    },
  };
}

export function handleArcTangentToolPointerMove(
  context: ToolPointerContext,
  state: ArcTangentToolState,
): ToolPointerResult {
  if (state.phase === "idle" || state.start === null || state.tangent === null) {
    return {
      previewPoint: context.worldPoint,
      previewArc: null,
      activeSnap: null,
      cursorWorld: context.worldPoint,
      creationSessionActive: false,
    };
  }
  const snapped = snapInContext(context);
  const built = tangentArcFromStart(state.start, state.tangent, snapped.point);
  return {
    previewPoint: snapped.point,
    previewArc:
      built === null
        ? null
        : {
            center: built.center,
            radius: built.radius,
            startAngle: built.startAngle,
            endAngle: built.endAngle,
            showFullCircleGuide: false,
          },
    circleRadiusMm: built?.radius ?? null,
    activeSnap: snapped.snap,
    cursorWorld: snapped.point,
    creationSessionActive: true,
  };
}

export function handleArcTangentToolPointerLeave(
  state: ArcTangentToolState,
): ToolPointerResult {
  return {
    previewPoint: null,
    previewArc: null,
    circleRadiusMm: null,
    activeSnap: null,
    cursorWorld: null,
    creationSessionActive: state.phase !== "idle",
  };
}

export function cancelArcTangentToolSession(state: ArcTangentToolState): {
  readonly state: ArcTangentToolState;
  readonly cancelled: boolean;
} {
  if (state.phase !== "idle") {
    return { state: createArcTangentToolState(), cancelled: true };
  }
  return { state, cancelled: false };
}

function pickLineAnchor(context: ToolPointerContext): {
  readonly point: Point2D;
  readonly tangent: Point2D;
  readonly lineId: EntityId;
} | null {
  const hit = hitTestSketch(context.sketch, context.worldPoint, {
    camera: context.camera,
  });
  if (hit === null) {
    return null;
  }
  const entity = context.sketch.geometry.find((item) => item.id === hit.entityId);
  if (entity === undefined || entity.type !== "line") {
    return null;
  }
  const line = entity as LineGeometry;
  const nearStart =
    distance(context.worldPoint, line.start) <=
    distance(context.worldPoint, line.end);
  const near: "start" | "end" = nearStart ? "start" : "end";
  const point = nearStart ? line.start : line.end;
  const tangent = lineTangentAtNearEnd(line.start, line.end, near);
  if (tangent === null) {
    return null;
  }
  if (distance(context.worldPoint, point) > 12 / context.camera.scale + TOLERANCE.coincidence) {
    // Prefer true endpoint hits; allow edge hits near ends.
    if (
      hit.part !== "endpoint-start" &&
      hit.part !== "endpoint-end" &&
      hit.part !== "edge"
    ) {
      return null;
    }
  }
  return { point, tangent, lineId: line.id };
}
