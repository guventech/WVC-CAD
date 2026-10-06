import { hitTestSketch } from "../selection/HitTesting.ts";
import { selectEntityInSketch } from "../selection/selectInSketch.ts";
import type { EntityId } from "../model/Geometry.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import type { ToolPointerContext, ToolPointerResult } from "./ToolTypes.ts";

export interface TrimExtendRequest {
  readonly entityId: EntityId;
  readonly clickWorld: Point2D;
}

function handleTrimOrExtendPointerDown(
  context: ToolPointerContext,
  mode: "trim" | "extend",
): ToolPointerResult {
  const hit = hitTestSketch(context.sketch, context.worldPoint, {
    camera: context.camera,
  });
  if (hit === null) {
    return {
      activeSnap: null,
      cursorWorld: context.worldPoint,
      creationSessionActive: false,
    };
  }

  const entity = context.sketch.geometry.find((item) => item.id === hit.entityId);
  if (entity === undefined || entity.type !== "line") {
    return {
      selection: selectEntityInSketch(
        context.selection,
        context.sketch.constraints,
        hit.entityId,
      ),
      activeSnap: null,
      cursorWorld: context.worldPoint,
      creationSessionActive: false,
    };
  }

  // Prefer body/endpoint hits; center of other types already filtered.
  if (
    hit.part !== "edge" &&
    hit.part !== "endpoint-start" &&
    hit.part !== "endpoint-end"
  ) {
    return {
      selection: selectEntityInSketch(
        context.selection,
        context.sketch.constraints,
        hit.entityId,
      ),
      activeSnap: null,
      cursorWorld: context.worldPoint,
      creationSessionActive: false,
    };
  }

  const request: TrimExtendRequest = {
    entityId: entity.id,
    clickWorld: { x: context.worldPoint.x, y: context.worldPoint.y },
  };

  return {
    ...(mode === "trim" ? { trimRequest: request } : { extendRequest: request }),
    selection: selectEntityInSketch(
      context.selection,
      context.sketch.constraints,
      entity.id,
    ),
    activeSnap: null,
    cursorWorld: context.worldPoint,
    creationSessionActive: false,
  };
}

export function handleTrimToolPointerDown(
  context: ToolPointerContext,
): ToolPointerResult {
  return handleTrimOrExtendPointerDown(context, "trim");
}

export function handleExtendToolPointerDown(
  context: ToolPointerContext,
): ToolPointerResult {
  return handleTrimOrExtendPointerDown(context, "extend");
}

export function handleTrimExtendToolPointerMove(
  context: ToolPointerContext,
): ToolPointerResult {
  return {
    activeSnap: null,
    cursorWorld: context.worldPoint,
    creationSessionActive: false,
  };
}

export function handleTrimExtendToolPointerLeave(): ToolPointerResult {
  return {
    activeSnap: null,
    cursorWorld: null,
    creationSessionActive: false,
  };
}
