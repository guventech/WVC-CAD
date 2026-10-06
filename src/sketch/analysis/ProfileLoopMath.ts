import type { Point2D } from "../geometry/Point2D.ts";
import { TOLERANCE } from "../geometry/GeometryMath.ts";

/** Signed area via shoelace (world Y up). Positive ⇒ CCW. */
export function signedPolygonArea(vertices: readonly Point2D[]): number {
  if (vertices.length < 3) {
    return 0;
  }
  let sum = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    const a = vertices[i]!;
    const b = vertices[(i + 1) % vertices.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

export function polygonCentroid(vertices: readonly Point2D[]): Point2D {
  if (vertices.length === 0) {
    return { x: 0, y: 0 };
  }
  let cx = 0;
  let cy = 0;
  for (const vertex of vertices) {
    cx += vertex.x;
    cy += vertex.y;
  }
  return { x: cx / vertices.length, y: cy / vertices.length };
}

/** Ray-cast point-in-polygon (boundary counts as inside). */
export function pointInPolygon(
  point: Point2D,
  vertices: readonly Point2D[],
): boolean {
  if (vertices.length < 3) {
    return false;
  }
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i, i += 1) {
    const a = vertices[i]!;
    const b = vertices[j]!;
    const intersects =
      a.y > point.y !== b.y > point.y &&
      point.x <
        ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y + Number.EPSILON) + a.x;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

export function circleContainsCircle(
  outerCenter: Point2D,
  outerRadius: number,
  innerCenter: Point2D,
  innerRadius: number,
): boolean {
  const dx = innerCenter.x - outerCenter.x;
  const dy = innerCenter.y - outerCenter.y;
  const dist = Math.hypot(dx, dy);
  return dist + innerRadius <= outerRadius + TOLERANCE.coincidence;
}

/** True when the circle lies entirely inside the polygon (coincidence tolerance). */
export function polygonContainsCircle(
  vertices: readonly Point2D[],
  center: Point2D,
  radius: number,
): boolean {
  if (!pointInPolygon(center, vertices)) {
    return false;
  }
  return minDistanceToPolygonBoundary(center, vertices) >= radius - TOLERANCE.coincidence;
}

function minDistanceToPolygonBoundary(
  point: Point2D,
  vertices: readonly Point2D[],
): number {
  let min = Number.POSITIVE_INFINITY;
  for (let i = 0; i < vertices.length; i += 1) {
    const a = vertices[i]!;
    const b = vertices[(i + 1) % vertices.length]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq <= TOLERANCE.geometric * TOLERANCE.geometric) {
      continue;
    }
    const t = Math.max(
      0,
      Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq),
    );
    const px = a.x + t * dx;
    const py = a.y + t * dy;
    const dist = Math.hypot(point.x - px, point.y - py);
    min = Math.min(min, dist);
  }
  return min;
}
