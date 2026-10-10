import { distance, TOLERANCE } from "./GeometryMath.ts";
import type { Point2D } from "./Point2D.ts";

/** Parallel offset of a finite segment by signed distance (left of start→end = positive). */
export function offsetLineSegment(
  start: Point2D,
  end: Point2D,
  signedDistance: number,
): { readonly start: Point2D; readonly end: Point2D } | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  if (!(len > TOLERANCE.coincidence)) {
    return null;
  }
  if (!(Math.abs(signedDistance) > TOLERANCE.coincidence)) {
    return null;
  }
  const nx = -dy / len;
  const ny = dx / len;
  return {
    start: {
      x: start.x + nx * signedDistance,
      y: start.y + ny * signedDistance,
    },
    end: {
      x: end.x + nx * signedDistance,
      y: end.y + ny * signedDistance,
    },
  };
}

/** Signed offset distance of a cursor from the infinite line through start→end. */
export function signedOffsetFromLine(
  start: Point2D,
  end: Point2D,
  cursor: Point2D,
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  if (!(len > TOLERANCE.coincidence)) {
    return 0;
  }
  return ((cursor.x - start.x) * -dy + (cursor.y - start.y) * dx) / len;
}

export function offsetDistanceMagnitude(
  start: Point2D,
  end: Point2D,
  cursor: Point2D,
): number {
  return Math.abs(signedOffsetFromLine(start, end, cursor));
}

export function pointDistance(a: Point2D, b: Point2D): number {
  return distance(a, b);
}

/**
 * Offset a closed polygon (vertices in order, not repeating the first at the end).
 * Positive distance offsets to the left of each edge direction (outward for CCW).
 */
export function offsetClosedPolygon(
  vertices: readonly Point2D[],
  signedDistance: number,
): Point2D[] | null {
  if (vertices.length < 3) {
    return null;
  }
  if (!(Math.abs(signedDistance) > TOLERANCE.coincidence)) {
    return null;
  }
  const n = vertices.length;
  const offsetEdges: { start: Point2D; end: Point2D }[] = [];
  for (let i = 0; i < n; i += 1) {
    const start = vertices[i]!;
    const end = vertices[(i + 1) % n]!;
    const offset = offsetLineSegment(start, end, signedDistance);
    if (offset === null) {
      return null;
    }
    offsetEdges.push(offset);
  }
  const result: Point2D[] = [];
  for (let i = 0; i < n; i += 1) {
    const prev = offsetEdges[(i + n - 1) % n]!;
    const curr = offsetEdges[i]!;
    const corner = intersectInfiniteLines(
      prev.start,
      prev.end,
      curr.start,
      curr.end,
    );
    if (corner === null) {
      return null;
    }
    result.push(corner);
  }
  return result;
}

/**
 * Offset an open polyline. End vertices follow their single edge;
 * interior vertices are mitered intersections of adjacent offset edges.
 */
export function offsetOpenPolyline(
  vertices: readonly Point2D[],
  signedDistance: number,
): Point2D[] | null {
  if (vertices.length < 2) {
    return null;
  }
  if (!(Math.abs(signedDistance) > TOLERANCE.coincidence)) {
    return null;
  }
  if (vertices.length === 2) {
    const seg = offsetLineSegment(vertices[0]!, vertices[1]!, signedDistance);
    if (seg === null) {
      return null;
    }
    return [seg.start, seg.end];
  }

  const edgeCount = vertices.length - 1;
  const offsetEdges: { start: Point2D; end: Point2D }[] = [];
  for (let i = 0; i < edgeCount; i += 1) {
    const offset = offsetLineSegment(
      vertices[i]!,
      vertices[i + 1]!,
      signedDistance,
    );
    if (offset === null) {
      return null;
    }
    offsetEdges.push(offset);
  }

  const result: Point2D[] = [offsetEdges[0]!.start];
  for (let i = 0; i < edgeCount - 1; i += 1) {
    const a = offsetEdges[i]!;
    const b = offsetEdges[i + 1]!;
    const corner = intersectInfiniteLines(a.start, a.end, b.start, b.end);
    if (corner === null) {
      return null;
    }
    result.push(corner);
  }
  result.push(offsetEdges[edgeCount - 1]!.end);
  return result;
}

/** Segments of a closed or open offset polyline (closed repeats first→last edge). */
export function polylineSegments(
  vertices: readonly Point2D[],
  closed: boolean,
): readonly { readonly start: Point2D; readonly end: Point2D }[] {
  if (vertices.length < 2) {
    return [];
  }
  const segments: { start: Point2D; end: Point2D }[] = [];
  for (let i = 0; i < vertices.length - 1; i += 1) {
    segments.push({ start: vertices[i]!, end: vertices[i + 1]! });
  }
  if (closed && vertices.length >= 3) {
    segments.push({
      start: vertices[vertices.length - 1]!,
      end: vertices[0]!,
    });
  }
  return segments;
}

function intersectInfiniteLines(
  a1: Point2D,
  a2: Point2D,
  b1: Point2D,
  b2: Point2D,
): Point2D | null {
  const dax = a2.x - a1.x;
  const day = a2.y - a1.y;
  const dbx = b2.x - b1.x;
  const dby = b2.y - b1.y;
  const denom = dax * dby - day * dbx;
  if (Math.abs(denom) <= TOLERANCE.geometric) {
    return null;
  }
  const t = ((b1.x - a1.x) * dby - (b1.y - a1.y) * dbx) / denom;
  return {
    x: a1.x + t * dax,
    y: a1.y + t * day,
  };
}
