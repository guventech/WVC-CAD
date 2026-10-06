import type { Point2D } from "./Point2D.ts";
import { TOLERANCE } from "./GeometryMath.ts";

/** Parametric intersection of two lines: P = a0 + tA*(a1-a0) = b0 + tB*(b1-b0). */
export interface LineIntersection {
  readonly point: Point2D;
  readonly tA: number;
  readonly tB: number;
}

/**
 * Intersection of two infinite lines. Returns null when parallel / degenerate.
 */
export function intersectInfiniteLines(
  a0: Point2D,
  a1: Point2D,
  b0: Point2D,
  b1: Point2D,
  tolerance: number = TOLERANCE.geometric,
): LineIntersection | null {
  const ax = a1.x - a0.x;
  const ay = a1.y - a0.y;
  const bx = b1.x - b0.x;
  const by = b1.y - b0.y;
  const denom = ax * by - ay * bx;

  if (Math.abs(denom) <= tolerance) {
    return null;
  }

  const dx = b0.x - a0.x;
  const dy = b0.y - a0.y;
  const tA = (dx * by - dy * bx) / denom;
  const tB = (dx * ay - dy * ax) / denom;

  return {
    point: {
      x: a0.x + tA * ax,
      y: a0.y + tA * ay,
    },
    tA,
    tB,
  };
}

/**
 * Proper crossing of two finite segments (parameters strictly inside (0,1)
 * within tolerance). Collinear overlaps are not treated as intersections.
 */
export function intersectLineSegments(
  a0: Point2D,
  a1: Point2D,
  b0: Point2D,
  b1: Point2D,
  tolerance: number = TOLERANCE.geometric,
): LineIntersection | null {
  const hit = intersectInfiniteLines(a0, a1, b0, b1, tolerance);
  if (hit === null) {
    return null;
  }

  if (
    !isInteriorParameter(hit.tA, tolerance) ||
    !isInteriorParameter(hit.tB, tolerance)
  ) {
    return null;
  }

  return hit;
}

/** Parameter t of `point` on infinite line a0→a1. Null if segment is degenerate. */
export function lineParameter(
  point: Point2D,
  a0: Point2D,
  a1: Point2D,
  tolerance: number = TOLERANCE.geometric,
): number | null {
  const ax = a1.x - a0.x;
  const ay = a1.y - a0.y;
  const lengthSq = ax * ax + ay * ay;
  if (lengthSq <= tolerance * tolerance) {
    return null;
  }
  return ((point.x - a0.x) * ax + (point.y - a0.y) * ay) / lengthSq;
}

export function pointAtParameter(
  a0: Point2D,
  a1: Point2D,
  t: number,
): Point2D {
  return {
    x: a0.x + t * (a1.x - a0.x),
    y: a0.y + t * (a1.y - a0.y),
  };
}

function isInteriorParameter(t: number, tolerance: number): boolean {
  return t > tolerance && t < 1 - tolerance && Number.isFinite(t);
}

/** True when t is approximately in [0, 1]. */
export function isOnSegmentParameter(
  t: number,
  tolerance: number = TOLERANCE.geometric,
): boolean {
  return Number.isFinite(t) && t >= -tolerance && t <= 1 + tolerance;
}

/** Intersection of an infinite line with a circle (0, 1, or 2 points). */
export interface LineCircleIntersection {
  readonly point: Point2D;
  /** Parameter on line a0→a1 (P = a0 + t*(a1-a0)). */
  readonly t: number;
}

/**
 * Intersect infinite line a0→a1 with circle (center, radius).
 * Returns 0–2 hits sorted by increasing `t`. Null radius / degenerate line → [].
 */
export function intersectLineCircle(
  a0: Point2D,
  a1: Point2D,
  center: Point2D,
  radius: number,
  tolerance: number = TOLERANCE.geometric,
): readonly LineCircleIntersection[] {
  if (!(radius > tolerance)) {
    return [];
  }
  const dx = a1.x - a0.x;
  const dy = a1.y - a0.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= tolerance * tolerance) {
    return [];
  }

  const fx = a0.x - center.x;
  const fy = a0.y - center.y;
  const a = lengthSq;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;
  const disc = b * b - 4 * a * c;

  if (disc < -tolerance) {
    return [];
  }

  const hits: LineCircleIntersection[] = [];
  if (Math.abs(disc) <= tolerance) {
    const t = -b / (2 * a);
    hits.push({
      point: { x: a0.x + t * dx, y: a0.y + t * dy },
      t,
    });
    return hits;
  }

  const sqrtDisc = Math.sqrt(disc);
  const t0 = (-b - sqrtDisc) / (2 * a);
  const t1 = (-b + sqrtDisc) / (2 * a);
  hits.push({ point: { x: a0.x + t0 * dx, y: a0.y + t0 * dy }, t: t0 });
  hits.push({ point: { x: a0.x + t1 * dx, y: a0.y + t1 * dy }, t: t1 });
  hits.sort((left, right) => left.t - right.t);
  return hits;
}

/** Circle–circle intersection (0, 1, or 2 points). Concentric → []. */
export function intersectCircles(
  c0: Point2D,
  r0: number,
  c1: Point2D,
  r1: number,
  tolerance: number = TOLERANCE.geometric,
): readonly Point2D[] {
  if (!(r0 > tolerance) || !(r1 > tolerance)) {
    return [];
  }
  const dx = c1.x - c0.x;
  const dy = c1.y - c0.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= tolerance) {
    return [];
  }

  if (dist > r0 + r1 + tolerance || dist < Math.abs(r0 - r1) - tolerance) {
    return [];
  }

  const a = (r0 * r0 - r1 * r1 + dist * dist) / (2 * dist);
  const hSq = r0 * r0 - a * a;
  const mx = c0.x + (a * dx) / dist;
  const my = c0.y + (a * dy) / dist;

  if (hSq <= tolerance * tolerance) {
    return [{ x: mx, y: my }];
  }

  const h = Math.sqrt(Math.max(0, hSq));
  const rx = (-dy * h) / dist;
  const ry = (dx * h) / dist;
  return [
    { x: mx + rx, y: my + ry },
    { x: mx - rx, y: my - ry },
  ];
}
