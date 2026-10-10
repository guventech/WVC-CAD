import {
  angleFromTo,
  distance,
  normalizeAngle,
  TOLERANCE,
} from "./GeometryMath.ts";
import type { Point2D } from "./Point2D.ts";

export type TangentArcResult = {
  readonly center: Point2D;
  readonly radius: number;
  readonly startAngle: number;
  readonly endAngle: number;
  readonly startPoint: Point2D;
  readonly endPoint: Point2D;
};

/**
 * Arc starting at `start` tangent to direction `tangent` (unit), ending at `end`.
 * Chooses the normal side that yields a positive finite radius.
 */
export function tangentArcFromStart(
  start: Point2D,
  tangent: Point2D,
  end: Point2D,
): TangentArcResult | null {
  const tLen = Math.hypot(tangent.x, tangent.y);
  if (!(tLen > TOLERANCE.coincidence)) {
    return null;
  }
  const tx = tangent.x / tLen;
  const ty = tangent.y / tLen;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const chord = Math.hypot(dx, dy);
  if (!(chord > TOLERANCE.coincidence)) {
    return null;
  }

  const candidates: readonly Point2D[] = [
    { x: -ty, y: tx },
    { x: ty, y: -tx },
  ];

  let best: TangentArcResult | null = null;
  for (const n of candidates) {
    const proj = dx * n.x + dy * n.y;
    if (!(Math.abs(proj) > TOLERANCE.coincidence)) {
      continue;
    }
    const radius = (chord * chord) / (2 * proj);
    if (!(radius > TOLERANCE.coincidence)) {
      continue;
    }
    const center = {
      x: start.x + n.x * radius,
      y: start.y + n.y * radius,
    };
    const startAngle = angleFromTo(center, start);
    const endAngle = angleFromTo(center, end);
    // Prefer the shorter CCW sweep that keeps tangency sense.
    const built: TangentArcResult = {
      center,
      radius,
      startAngle: normalizeAngle(startAngle),
      endAngle: normalizeAngle(endAngle),
      startPoint: start,
      endPoint: end,
    };
    if (
      best === null ||
      distance(center, end) < distance(best.center, end)
    ) {
      best = built;
    }
  }
  return best;
}

/** Unit direction of line at the nearer endpoint, pointing along the line away from the far end. */
export function lineTangentAtNearEnd(
  start: Point2D,
  end: Point2D,
  near: "start" | "end",
): Point2D | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  if (!(len > TOLERANCE.coincidence)) {
    return null;
  }
  if (near === "start") {
    return { x: dx / len, y: dy / len };
  }
  return { x: -dx / len, y: -dy / len };
}
