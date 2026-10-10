import type { Point2D } from "./Point2D.ts";
import { TOLERANCE } from "./GeometryMath.ts";

/** Unique circle through three non-collinear points, or null. */
export function circleFromThreePoints(
  a: Point2D,
  b: Point2D,
  c: Point2D,
): { readonly center: Point2D; readonly radius: number } | null {
  const d =
    2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) <= TOLERANCE.geometric) {
    return null;
  }
  const aSq = a.x * a.x + a.y * a.y;
  const bSq = b.x * b.x + b.y * b.y;
  const cSq = c.x * c.x + c.y * c.y;
  const center = {
    x: (aSq * (b.y - c.y) + bSq * (c.y - a.y) + cSq * (a.y - b.y)) / d,
    y: (aSq * (c.x - b.x) + bSq * (a.x - c.x) + cSq * (b.x - a.x)) / d,
  };
  const radius = Math.hypot(a.x - center.x, a.y - center.y);
  if (!(radius > TOLERANCE.coincidence)) {
    return null;
  }
  return { center, radius };
}
