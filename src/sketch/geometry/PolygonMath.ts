import { angleFromTo, distance, TOLERANCE } from "./GeometryMath.ts";
import type { Point2D } from "./Point2D.ts";

export const DEFAULT_POLYGON_SIDES = 6;
export const MIN_POLYGON_SIDES = 3;
export const MAX_POLYGON_SIDES = 32;

/** Clamp side count into the supported regular-polygon range. */
export function clampPolygonSides(sides: number): number {
  if (!Number.isFinite(sides)) {
    return DEFAULT_POLYGON_SIDES;
  }
  const rounded = Math.round(sides);
  return Math.min(MAX_POLYGON_SIDES, Math.max(MIN_POLYGON_SIDES, rounded));
}

/** Regular N-gon vertices CCW, first vertex toward `radiusPoint` from center. */
export function regularPolygonVertices(
  center: Point2D,
  radiusPoint: Point2D,
  sides: number = DEFAULT_POLYGON_SIDES,
): readonly Point2D[] | null {
  const n = clampPolygonSides(sides);
  const radius = distance(center, radiusPoint);
  if (!(radius > TOLERANCE.coincidence)) {
    return null;
  }
  const start = angleFromTo(center, radiusPoint);
  const step = (Math.PI * 2) / n;
  const vertices: Point2D[] = [];
  for (let i = 0; i < n; i += 1) {
    const angle = start + i * step;
    vertices.push({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    });
  }
  return vertices;
}
