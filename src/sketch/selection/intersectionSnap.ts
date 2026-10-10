import { angleFromTo, isAngleInArcSweep } from "../geometry/GeometryMath.ts";
import {
  intersectCircles,
  intersectInfiniteLines,
  intersectLineCircle,
} from "../geometry/Intersections.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import type { EntityId, Geometry } from "../model/Geometry.ts";
import type { SnapCandidate } from "./SnapTypes.ts";

/** Priority between endpoint (90) and midpoint (85). */
export const INTERSECTION_SNAP_PRIORITY = 88;

type CurveSupport =
  | {
      readonly kind: "line";
      readonly id: EntityId;
      readonly a0: Point2D;
      readonly a1: Point2D;
    }
  | {
      readonly kind: "circle";
      readonly id: EntityId;
      readonly center: Point2D;
      readonly radius: number;
    }
  | {
      readonly kind: "arc";
      readonly id: EntityId;
      readonly center: Point2D;
      readonly radius: number;
      readonly startAngle: number;
      readonly endAngle: number;
    };

/**
 * Collect geometric intersection snap candidates between solid/construction curves.
 * `findSnap` still applies screen-space tolerance.
 */
export function collectIntersectionCandidates(
  geometry: readonly Geometry[],
  exclude: ReadonlySet<EntityId>,
): SnapCandidate[] {
  const curves: CurveSupport[] = [];
  for (const entity of geometry) {
    if (exclude.has(entity.id)) {
      continue;
    }
    const curve = curveFromEntity(entity);
    if (curve !== null) {
      curves.push(curve);
    }
  }

  const candidates: SnapCandidate[] = [];
  for (let i = 0; i < curves.length; i += 1) {
    for (let j = i + 1; j < curves.length; j += 1) {
      for (const point of intersectCurves(curves[i]!, curves[j]!)) {
        candidates.push({
          type: "intersection",
          point,
          sourceEntityId: curves[i]!.id,
          priority: INTERSECTION_SNAP_PRIORITY,
          label: "Intersection",
        });
      }
    }
  }
  return candidates;
}

function curveFromEntity(entity: Geometry): CurveSupport | null {
  switch (entity.type) {
    case "line":
      return {
        kind: "line",
        id: entity.id,
        a0: entity.start,
        a1: entity.end,
      };
    case "circle":
      return {
        kind: "circle",
        id: entity.id,
        center: entity.center,
        radius: entity.radius,
      };
    case "arc":
      return {
        kind: "arc",
        id: entity.id,
        center: entity.center,
        radius: entity.radius,
        startAngle: entity.startAngle,
        endAngle: entity.endAngle,
      };
    default:
      return null;
  }
}

function intersectCurves(a: CurveSupport, b: CurveSupport): readonly Point2D[] {
  if (a.kind === "line" && b.kind === "line") {
    const hit = intersectInfiniteLines(a.a0, a.a1, b.a0, b.a1);
    return hit === null ? [] : [hit.point];
  }

  if (a.kind === "line" && (b.kind === "circle" || b.kind === "arc")) {
    return filterCircleHits(
      intersectLineCircle(a.a0, a.a1, b.center, b.radius).map((hit) => hit.point),
      b,
    );
  }
  if (b.kind === "line" && (a.kind === "circle" || a.kind === "arc")) {
    return filterCircleHits(
      intersectLineCircle(b.a0, b.a1, a.center, a.radius).map((hit) => hit.point),
      a,
    );
  }

  if (
    (a.kind === "circle" || a.kind === "arc") &&
    (b.kind === "circle" || b.kind === "arc")
  ) {
    return filterCircleHits(
      filterCircleHits(intersectCircles(a.center, a.radius, b.center, b.radius), a),
      b,
    );
  }

  return [];
}

function filterCircleHits(
  points: readonly Point2D[],
  curve: CurveSupport,
): readonly Point2D[] {
  if (curve.kind === "circle" || curve.kind === "line") {
    return points;
  }
  return points.filter((point) =>
    isAngleInArcSweep(
      angleFromTo(curve.center, point),
      curve.startAngle,
      curve.endAngle,
    ),
  );
}
