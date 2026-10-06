import type { ConstraintReference } from "../model/Constraint.ts";
import type { Sketch } from "../model/Sketch.ts";
import type { HitResult } from "../selection/HitTesting.ts";
import {
  cornerPointIdForEdgeEndpoint,
  findRectangleFeatureForEntity,
} from "../model/RectangleFeature.ts";
import {
  findFrameAxis,
  isDatumOriginId,
} from "../model/SketchFrame.ts";
import { normalizePointLikeRef } from "./ConstraintRef.ts";

export type ConstraintPick =
  | { readonly kind: "point-like"; readonly ref: ConstraintReference }
  | { readonly kind: "line-object"; readonly ref: ConstraintReference };

/**
 * Map a hit-test result to a constraint reference for the Coincident tool.
 */
export function constraintPickFromHit(
  sketch: Sketch,
  hit: HitResult,
): ConstraintPick | null {
  if (isDatumOriginId(sketch.frame, hit.entityId) && hit.part === "point") {
    return {
      kind: "point-like",
      ref: { entityId: hit.entityId, role: "position" },
    };
  }

  if (findFrameAxis(sketch.frame, hit.entityId) !== null && hit.part === "edge") {
    return {
      kind: "line-object",
      ref: { entityId: hit.entityId, role: "entity" },
    };
  }

  const entity = sketch.geometry.find((item) => item.id === hit.entityId);
  if (entity === undefined) {
    return null;
  }

  if (entity.type === "point" && hit.part === "point") {
    return {
      kind: "point-like",
      ref: { entityId: entity.id, role: "position" },
    };
  }

  if (entity.type === "line") {
    if (hit.part === "endpoint-start" || hit.part === "endpoint-end") {
      const which = hit.part === "endpoint-start" ? "start" : "end";
      const feature = findRectangleFeatureForEntity(
        sketch.constraints,
        entity.id,
      );
      if (feature !== null) {
        const cornerId = cornerPointIdForEdgeEndpoint(feature, entity.id, which);
        if (cornerId !== null) {
          return {
            kind: "point-like",
            ref: { entityId: cornerId, role: "position" },
          };
        }
      }
      return {
        kind: "point-like",
        ref: normalizePointLikeRef(sketch, {
          entityId: entity.id,
          role: which,
        }),
      };
    }
    if (hit.part === "edge") {
      return {
        kind: "line-object",
        ref: { entityId: entity.id, role: "entity" },
      };
    }
  }

  if (
    (entity.type === "circle" || entity.type === "arc") &&
    hit.part === "center"
  ) {
    return {
      kind: "point-like",
      ref: { entityId: entity.id, role: "center" },
    };
  }

  return null;
}
