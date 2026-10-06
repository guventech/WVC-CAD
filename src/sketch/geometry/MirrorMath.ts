import type { Point2D } from "./Point2D.ts";
import {
  angleFromTo,
  normalizeAngle,
  projectPointOntoLine,
  TOLERANCE,
} from "./GeometryMath.ts";
import type {
  ArcGeometry,
  CircleGeometry,
  Geometry,
  LineGeometry,
  PointGeometry,
} from "../model/Geometry.ts";
import { createEntityId } from "../model/EntityId.ts";

/** Reflect a point across the infinite line through `a0`→`a1`. */
export function reflectPointAcrossLine(
  point: Point2D,
  a0: Point2D,
  a1: Point2D,
): Point2D {
  const projected = projectPointOntoLine(point, a0, a1);
  return {
    x: 2 * projected.x - point.x,
    y: 2 * projected.y - point.y,
  };
}

/**
 * Mirror one geometry entity across an axis. Returns a new entity with a fresh id.
 * Arc orientation is flipped by reflection, so start/end angles are swapped to
 * keep the stored CCW convention.
 */
export function mirrorGeometryAcrossLine(
  entity: Geometry,
  a0: Point2D,
  a1: Point2D,
): Geometry {
  switch (entity.type) {
    case "point":
      return mirrorPoint(entity, a0, a1);
    case "line":
      return mirrorLine(entity, a0, a1);
    case "circle":
      return mirrorCircle(entity, a0, a1);
    case "arc":
      return mirrorArc(entity, a0, a1);
  }
}

function mirrorPoint(
  entity: PointGeometry,
  a0: Point2D,
  a1: Point2D,
): PointGeometry {
  return {
    id: createEntityId("point"),
    type: "point",
    position: reflectPointAcrossLine(entity.position, a0, a1),
    construction: entity.construction,
  };
}

function mirrorLine(
  entity: LineGeometry,
  a0: Point2D,
  a1: Point2D,
): LineGeometry {
  return {
    id: createEntityId("line"),
    type: "line",
    start: reflectPointAcrossLine(entity.start, a0, a1),
    end: reflectPointAcrossLine(entity.end, a0, a1),
    construction: entity.construction,
  };
}

function mirrorCircle(
  entity: CircleGeometry,
  a0: Point2D,
  a1: Point2D,
): CircleGeometry {
  return {
    id: createEntityId("circle"),
    type: "circle",
    center: reflectPointAcrossLine(entity.center, a0, a1),
    radius: entity.radius,
    construction: entity.construction,
  };
}

function mirrorArc(entity: ArcGeometry, a0: Point2D, a1: Point2D): ArcGeometry {
  const center = reflectPointAcrossLine(entity.center, a0, a1);
  const startPoint = reflectPointAcrossLine(
    {
      x: entity.center.x + entity.radius * Math.cos(entity.startAngle),
      y: entity.center.y + entity.radius * Math.sin(entity.startAngle),
    },
    a0,
    a1,
  );
  const endPoint = reflectPointAcrossLine(
    {
      x: entity.center.x + entity.radius * Math.cos(entity.endAngle),
      y: entity.center.y + entity.radius * Math.sin(entity.endAngle),
    },
    a0,
    a1,
  );

  // Reflection reverses orientation: CCW image is CW, so store end'→start' as CCW.
  const startAngle = normalizeAngle(angleFromTo(center, endPoint));
  const endAngle = normalizeAngle(angleFromTo(center, startPoint));

  return {
    id: createEntityId("arc"),
    type: "arc",
    center,
    radius: entity.radius,
    startAngle,
    endAngle,
    construction: entity.construction,
  };
}

/** True when the mirror axis segment is long enough to define a direction. */
export function isValidMirrorAxis(
  a0: Point2D,
  a1: Point2D,
  tolerance: number = TOLERANCE.coincidence,
): boolean {
  const dx = a1.x - a0.x;
  const dy = a1.y - a0.y;
  return dx * dx + dy * dy > tolerance * tolerance;
}
