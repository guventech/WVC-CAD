import type { Point2D } from "../geometry/Point2D.ts";
import type { EntityId } from "../model/Geometry.ts";
import {
  offsetClosedPolygon,
  offsetLineSegment,
  offsetOpenPolyline,
  polylineSegments,
  signedOffsetFromLine,
} from "../geometry/OffsetMath.ts";
import {
  resolveOffsetSource,
  type OffsetSource,
} from "../geometry/OffsetSource.ts";
import { distance, TOLERANCE } from "../geometry/GeometryMath.ts";
import { hitTestSketch } from "../selection/HitTesting.ts";
import {
  snapInContext,
  type ToolPointerContext,
  type ToolPointerResult,
} from "./ToolTypes.ts";

export type OffsetToolPhase = "idle" | "sourceSet";

export interface OffsetToolState {
  readonly phase: OffsetToolPhase;
  readonly source: OffsetSource | null;
  readonly seedEntityId: EntityId | null;
}

export function createOffsetToolState(): OffsetToolState {
  return { phase: "idle", source: null, seedEntityId: null };
}

export function handleOffsetToolPointerDown(
  context: ToolPointerContext,
  state: OffsetToolState,
): { readonly result: ToolPointerResult; readonly state: OffsetToolState } {
  if (state.phase === "idle" || state.source === null) {
    const picked = pickOffsetEntity(context);
    if (picked === null) {
      return {
        state,
        result: {
          previewPoint: context.worldPoint,
          previewLine: null,
          previewPolyline: null,
          activeSnap: null,
          cursorWorld: context.worldPoint,
          creationSessionActive: false,
        },
      };
    }
    return {
      state: {
        phase: "sourceSet",
        source: picked.source,
        seedEntityId: picked.entityId,
      },
      result: {
        previewPoint: context.worldPoint,
        previewLine: null,
        previewPolyline: null,
        activeSnap: null,
        cursorWorld: context.worldPoint,
        creationSessionActive: true,
      },
    };
  }

  const snapped = snapInContext(context);
  const built = buildOffsetResult(state.source, snapped.point);
  if (built === null) {
    return {
      state,
      result: {
        previewPoint: snapped.point,
        previewLine: null,
        previewPolyline: null,
        activeSnap: snapped.snap,
        cursorWorld: snapped.point,
        creationSessionActive: true,
      },
    };
  }

  return {
    state: createOffsetToolState(),
    result: {
      ...built.commit,
      previewPoint: null,
      previewLine: null,
      previewPolyline: null,
      activeSnap: snapped.snap,
      cursorWorld: snapped.point,
      creationSessionActive: false,
    },
  };
}

export function handleOffsetToolPointerMove(
  context: ToolPointerContext,
  state: OffsetToolState,
): ToolPointerResult {
  if (state.phase === "idle" || state.source === null) {
    return {
      previewPoint: context.worldPoint,
      previewLine: null,
      previewPolyline: null,
      activeSnap: null,
      cursorWorld: context.worldPoint,
      creationSessionActive: false,
    };
  }
  const snapped = snapInContext(context);
  const built = buildOffsetResult(state.source, snapped.point);
  if (built === null) {
    return {
      previewPoint: snapped.point,
      previewLine: null,
      previewPolyline: null,
      activeSnap: snapped.snap,
      cursorWorld: snapped.point,
      creationSessionActive: true,
    };
  }
  return {
    previewPoint: snapped.point,
    previewLine: built.previewLine,
    previewPolyline: built.previewPolyline,
    previewCircle: built.previewCircle ?? null,
    circleRadiusMm:
      built.previewCircle != null
        ? distance(
            built.previewCircle.center,
            built.previewCircle.radiusPoint,
          )
        : null,
    lineMetrics: built.lineMetrics,
    activeSnap: snapped.snap,
    cursorWorld: snapped.point,
    creationSessionActive: true,
  };
}

export function handleOffsetToolPointerLeave(
  state: OffsetToolState,
): ToolPointerResult {
  return {
    previewPoint: null,
    previewLine: null,
    previewPolyline: null,
    activeSnap: null,
    cursorWorld: null,
    creationSessionActive: state.phase !== "idle",
  };
}

export function cancelOffsetToolSession(state: OffsetToolState): {
  readonly state: OffsetToolState;
  readonly cancelled: boolean;
} {
  if (state.phase !== "idle") {
    return { state: createOffsetToolState(), cancelled: true };
  }
  return { state, cancelled: false };
}

function pickOffsetEntity(context: ToolPointerContext): {
  readonly entityId: EntityId;
  readonly source: OffsetSource;
} | null {
  const hit = hitTestSketch(context.sketch, context.worldPoint, {
    camera: context.camera,
  });
  if (hit === null) {
    return null;
  }
  const source = resolveOffsetSource(context.sketch, hit.entityId);
  if (source === null) {
    return null;
  }
  return { entityId: hit.entityId, source };
}

function buildOffsetResult(
  source: OffsetSource,
  cursor: Point2D,
): {
  readonly commit: ToolPointerResult;
  readonly previewLine: ToolPointerResult["previewLine"];
  readonly previewPolyline: ToolPointerResult["previewPolyline"];
  readonly previewCircle?: ToolPointerResult["previewCircle"];
  readonly lineMetrics: ToolPointerResult["lineMetrics"];
} | null {
  if (source.kind === "segment") {
    const signed = signedOffsetFromLine(source.start, source.end, cursor);
    const offset = offsetLineSegment(source.start, source.end, signed);
    if (offset === null) {
      return null;
    }
    return {
      commit: { createLine: { start: offset.start, end: offset.end } },
      previewLine: { start: offset.start, end: offset.end },
      previewPolyline: null,
      lineMetrics: {
        lengthMm: distance(offset.start, offset.end),
        angleDegrees:
          (Math.atan2(
            offset.end.y - offset.start.y,
            offset.end.x - offset.start.x,
          ) *
            180) /
          Math.PI,
      },
    };
  }

  if (source.kind === "circle") {
    const radial = distance(source.center, cursor);
    if (!(radial > TOLERANCE.coincidence)) {
      return null;
    }
    const radiusPoint = {
      x: source.center.x + radial,
      y: source.center.y,
    };
    return {
      commit: {
        createCircle: { center: source.center, radiusPoint },
      },
      previewLine: null,
      previewPolyline: null,
      previewCircle: { center: source.center, radiusPoint },
      lineMetrics: {
        lengthMm: radial,
        angleDegrees: 0,
      },
    };
  }

  const signed = signedOffsetFromLine(
    source.seedStart,
    source.seedEnd,
    cursor,
  );
  const offsetVerts = source.closed
    ? offsetClosedPolygon(source.vertices, signed)
    : offsetOpenPolyline(source.vertices, signed);
  if (offsetVerts === null) {
    return null;
  }
  const segments = polylineSegments(offsetVerts, source.closed);
  if (segments.length === 0) {
    return null;
  }
  return {
    commit: {
      createOffsetSegments: segments.map((segment) => ({
        start: segment.start,
        end: segment.end,
      })),
    },
    previewLine: null,
    previewPolyline: {
      vertices: offsetVerts,
      closed: source.closed,
    },
    lineMetrics: {
      lengthMm: Math.abs(signed),
      angleDegrees: 0,
    },
  };
}
