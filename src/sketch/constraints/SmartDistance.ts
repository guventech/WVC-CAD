import { TOLERANCE } from "../geometry/GeometryMath.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import type { ConstraintReference } from "../model/Constraint.ts";
/** ~2° — treat nearly axis-aligned spans as H/V distance (commercial smart-dim). */
const AXIS_ALIGN_SIN = Math.sin((2 * Math.PI) / 180);

export type PointPairDistanceType =
  | "horizontal-distance"
  | "vertical-distance"
  | "distance";

export type SmartDistanceKind =
  | { readonly type: "length"; readonly lineRef: ConstraintReference }
  | {
      readonly type: PointPairDistanceType;
      readonly a: ConstraintReference;
      readonly b: ConstraintReference;
    };

/**
 * Classify a distance dimension from geometry:
 * - one line → Euclidean `length` on that line
 * - two points → H / V / Euclidean `distance` by alignment
 */
export function classifySmartDistance(
  lineRef: ConstraintReference | null,
  pointA: ConstraintReference | null,
  pointB: ConstraintReference | null,
  pointAWorld: Point2D | null,
  pointBWorld: Point2D | null,
): SmartDistanceKind | null {
  if (lineRef !== null) {
    return { type: "length", lineRef };
  }
  if (
    pointA === null ||
    pointB === null ||
    pointAWorld === null ||
    pointBWorld === null
  ) {
    return null;
  }
  const dx = Math.abs(pointBWorld.x - pointAWorld.x);
  const dy = Math.abs(pointBWorld.y - pointAWorld.y);
  const hyp = Math.hypot(dx, dy);
  if (!(hyp > TOLERANCE.coincidence)) {
    return null;
  }
  const type = choosePointPairDistanceType(dx, dy, hyp);
  return { type, a: pointA, b: pointB };
}

export function choosePointPairDistanceType(
  dx: number,
  dy: number,
  hyp: number,
): PointPairDistanceType {
  if (dy / hyp <= AXIS_ALIGN_SIN) {
    return "horizontal-distance";
  }
  if (dx / hyp <= AXIS_ALIGN_SIN) {
    return "vertical-distance";
  }
  return "distance";
}
