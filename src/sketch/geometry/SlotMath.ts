import { distance, TOLERANCE } from "./GeometryMath.ts";
import type { Point2D } from "./Point2D.ts";

export type SlotOutline = {
  readonly lineA: { readonly start: Point2D; readonly end: Point2D };
  readonly lineB: { readonly start: Point2D; readonly end: Point2D };
  readonly arcStart: {
    readonly center: Point2D;
    readonly radius: number;
    readonly startAngle: number;
    readonly endAngle: number;
  };
  readonly arcEnd: {
    readonly center: Point2D;
    readonly radius: number;
    readonly startAngle: number;
    readonly endAngle: number;
  };
};

/**
 * Capsule / slot between two end centers with half-width `halfWidth`.
 * Parallel sides + semicircle caps (CCW outer loop).
 */
export function slotOutlineFromCenters(
  centerA: Point2D,
  centerB: Point2D,
  halfWidth: number,
): SlotOutline | null {
  if (!(halfWidth > TOLERANCE.coincidence)) {
    return null;
  }
  const len = distance(centerA, centerB);
  if (!(len > TOLERANCE.coincidence)) {
    return null;
  }
  const ux = (centerB.x - centerA.x) / len;
  const uy = (centerB.y - centerA.y) / len;
  const px = -uy;
  const py = ux;
  const aLeft = {
    x: centerA.x + px * halfWidth,
    y: centerA.y + py * halfWidth,
  };
  const aRight = {
    x: centerA.x - px * halfWidth,
    y: centerA.y - py * halfWidth,
  };
  const bLeft = {
    x: centerB.x + px * halfWidth,
    y: centerB.y + py * halfWidth,
  };
  const bRight = {
    x: centerB.x - px * halfWidth,
    y: centerB.y - py * halfWidth,
  };
  const along = Math.atan2(uy, ux);
  return {
    lineA: { start: aLeft, end: bLeft },
    lineB: { start: bRight, end: aRight },
    arcStart: {
      center: centerA,
      radius: halfWidth,
      startAngle: along + Math.PI / 2,
      endAngle: along - Math.PI / 2 + Math.PI * 2,
    },
    arcEnd: {
      center: centerB,
      radius: halfWidth,
      startAngle: along - Math.PI / 2,
      endAngle: along + Math.PI / 2,
    },
  };
}

/** Half-width from cursor distance to the centerline (clamped). */
export function slotHalfWidthFromCursor(
  centerA: Point2D,
  centerB: Point2D,
  cursor: Point2D,
): number {
  const len = distance(centerA, centerB);
  if (!(len > TOLERANCE.coincidence)) {
    return 0;
  }
  const ux = (centerB.x - centerA.x) / len;
  const uy = (centerB.y - centerA.y) / len;
  const dx = cursor.x - centerA.x;
  const dy = cursor.y - centerA.y;
  return Math.abs(dx * -uy + dy * ux);
}
