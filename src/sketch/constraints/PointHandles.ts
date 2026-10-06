import {
  moveArcCenterInSketch,
  moveCircleCenterInSketch,
  moveLineEndpointInSketch,
  movePointInSketch,
} from "../commands/MovePointCommand.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import type { ConstraintReference } from "../model/Constraint.ts";
import type { Sketch } from "../model/Sketch.ts";
import { findEntity, normalizePointLikeRef } from "./ConstraintRef.ts";
import type { HandleClusters } from "./HandleClusters.ts";

/** Move one point-like handle (rectangle corners go through the feature path). */
export function setPointHandle(
  sketch: Sketch,
  ref: ConstraintReference,
  position: Point2D,
): Sketch {
  const normalized = normalizePointLikeRef(sketch, ref);
  const entity = findEntity(sketch, normalized.entityId);
  if (entity === undefined) {
    return sketch;
  }

  switch (entity.type) {
    case "point":
      return movePointInSketch(sketch, entity.id, position);
    case "line":
      if (normalized.role === "start" || normalized.role === "end") {
        return moveLineEndpointInSketch(
          sketch,
          entity.id,
          normalized.role,
          position,
        );
      }
      return sketch;
    case "circle":
      if (normalized.role === "center") {
        return moveCircleCenterInSketch(sketch, entity.id, position);
      }
      return sketch;
    case "arc":
      if (normalized.role === "center") {
        return moveArcCenterInSketch(sketch, entity.id, position);
      }
      return sketch;
  }
}

/** Move a handle and every handle coincident with it. */
export function setPointHandleWithCluster(
  sketch: Sketch,
  clusters: HandleClusters,
  ref: ConstraintReference,
  position: Point2D,
): Sketch {
  let next = sketch;
  for (const member of clusters.membersOf(normalizePointLikeRef(sketch, ref))) {
    next = setPointHandle(next, member, position);
  }
  return next;
}
