import {
  distance,
  distancePointToSegment,
  isAngleInArcSweep,
  TOLERANCE,
} from "../geometry/GeometryMath.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import type { Geometry } from "../model/Geometry.ts";
import type { SnapCandidate } from "./SnapTypes.ts";

const ON_ENTITY_PRIORITY = 55;

/** Project cursor onto line/circle/arc when within world tolerance. */
export function collectOnEntityCandidate(
  entity: Geometry,
  worldPoint: Point2D,
  toleranceWorld: number,
): SnapCandidate | null {
  if (entity.type === "line") {
    const dist = distancePointToSegment(worldPoint, entity.start, entity.end);
    if (dist > toleranceWorld) {
      return null;
    }
    const projected = projectPointOnSegment(worldPoint, entity.start, entity.end);
    if (
      distance(projected, entity.start) <= TOLERANCE.coincidence ||
      distance(projected, entity.end) <= TOLERANCE.coincidence
    ) {
      return null;
    }
    return {
      type: "onEntity",
      point: projected,
      sourceEntityId: entity.id,
      priority: ON_ENTITY_PRIORITY,
      label: "On line",
    };
  }

  if (entity.type === "circle") {
    const centerDist = distance(worldPoint, entity.center);
    const edgeDist = Math.abs(centerDist - entity.radius);
    if (edgeDist > toleranceWorld || !(entity.radius > TOLERANCE.coincidence)) {
      return null;
    }
    if (centerDist <= TOLERANCE.coincidence) {
      return null;
    }
    const scale = entity.radius / centerDist;
    return {
      type: "onEntity",
      point: {
        x: entity.center.x + (worldPoint.x - entity.center.x) * scale,
        y: entity.center.y + (worldPoint.y - entity.center.y) * scale,
      },
      sourceEntityId: entity.id,
      priority: ON_ENTITY_PRIORITY,
      label: "On circle",
    };
  }

  if (entity.type === "arc") {
    const centerDist = distance(worldPoint, entity.center);
    const edgeDist = Math.abs(centerDist - entity.radius);
    if (edgeDist > toleranceWorld || !(entity.radius > TOLERANCE.coincidence)) {
      return null;
    }
    if (centerDist <= TOLERANCE.coincidence) {
      return null;
    }
    const angle = Math.atan2(
      worldPoint.y - entity.center.y,
      worldPoint.x - entity.center.x,
    );
    if (!isAngleInArcSweep(angle, entity.startAngle, entity.endAngle)) {
      return null;
    }
    const scale = entity.radius / centerDist;
    return {
      type: "onEntity",
      point: {
        x: entity.center.x + (worldPoint.x - entity.center.x) * scale,
        y: entity.center.y + (worldPoint.y - entity.center.y) * scale,
      },
      sourceEntityId: entity.id,
      priority: ON_ENTITY_PRIORITY,
      label: "On arc",
    };
  }

  return null;
}

function projectPointOnSegment(
  point: Point2D,
  start: Point2D,
  end: Point2D,
): Point2D {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= TOLERANCE.geometric * TOLERANCE.geometric) {
    return { x: start.x, y: start.y };
  }
  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq),
  );
  return {
    x: start.x + t * dx,
    y: start.y + t * dy,
  };
}
