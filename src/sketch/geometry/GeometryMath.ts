import type { Point2D } from "./Point2D.ts";

export const TOLERANCE = {
  geometric: 1e-7,
  display: 1e-4,
  coincidence: 1e-6,
  solverResidual: 1e-8,
  /** Radians; angle-dimension satisfaction during provisional maintenance. */
  angular: 1e-7,
} as const;

export function isApproximatelyEqual(
  a: number,
  b: number,
  tolerance: number = TOLERANCE.geometric,
): boolean {
  return Math.abs(a - b) <= tolerance;
}

export function pointsApproximatelyEqual(
  a: Point2D,
  b: Point2D,
  tolerance: number = TOLERANCE.geometric,
): boolean {
  return (
    isApproximatelyEqual(a.x, b.x, tolerance) &&
    isApproximatelyEqual(a.y, b.y, tolerance)
  );
}

export function distance(a: Point2D, b: Point2D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

/**
 * Closest point on the infinite line through `start`→`end`.
 * Degenerate segments return `start`.
 */
export function projectPointOntoLine(
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

  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq;
  return {
    x: start.x + t * dx,
    y: start.y + t * dy,
  };
}

/** Closest point on a finite line segment to `point`. */
export function closestPointOnSegment(
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

/** Shortest distance from a point to a finite line segment. */
export function distancePointToSegment(
  point: Point2D,
  start: Point2D,
  end: Point2D,
): number {
  return distance(point, closestPointOnSegment(point, start, end));
}

/** Angle of the vector from `origin` to `point`, radians, range (-π, π]. */
export function angleFromTo(origin: Point2D, point: Point2D): number {
  return Math.atan2(point.y - origin.y, point.x - origin.x);
}

/** Normalize radians into [0, 2π). */
export function normalizeAngle(angle: number): number {
  const twoPi = Math.PI * 2;
  const normalized = angle % twoPi;
  return normalized < 0 ? normalized + twoPi : normalized;
}

/**
 * True when `angle` lies on the CCW sweep from `startAngle` to `endAngle`.
 * A full circle (start == end) is treated as covering every angle.
 */
export function isAngleInArcSweep(
  angle: number,
  startAngle: number,
  endAngle: number,
): boolean {
  const start = normalizeAngle(startAngle);
  const end = normalizeAngle(endAngle);
  const value = normalizeAngle(angle);

  if (isApproximatelyEqual(start, end, TOLERANCE.geometric)) {
    return true;
  }

  if (start < end) {
    return value >= start - TOLERANCE.geometric && value <= end + TOLERANCE.geometric;
  }

  return value >= start - TOLERANCE.geometric || value <= end + TOLERANCE.geometric;
}

/** CCW sweep length in radians from start to end, in (0, 2π]. */
export function arcSweepRadians(startAngle: number, endAngle: number): number {
  const start = normalizeAngle(startAngle);
  const end = normalizeAngle(endAngle);
  if (isApproximatelyEqual(start, end, TOLERANCE.geometric)) {
    return Math.PI * 2;
  }
  return end > start ? end - start : Math.PI * 2 - (start - end);
}

/** Angle at the midpoint of a CCW arc sweep (for labels / radial leaders). */
export function arcMidAngle(startAngle: number, endAngle: number): number {
  return normalizeAngle(startAngle) + arcSweepRadians(startAngle, endAngle) / 2;
}
