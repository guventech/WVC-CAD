import type { Point2D } from "./Point2D.ts";
import { angleFromTo, distance, projectPointOntoLine, TOLERANCE } from "./GeometryMath.ts";
import { intersectInfiniteLines } from "./Intersections.ts";
import type { ArcGeometry, LineGeometry } from "../model/Geometry.ts";
import type { Sketch } from "../model/Sketch.ts";
import {
  parseFilletFeature,
  type FilletFeatureIds,
} from "../model/FilletChamferFeature.ts";

/** Signed distance from point to the infinite line through `line` (left of start→end is positive). */
export function signedDistanceToLine(
  point: Point2D,
  line: LineGeometry,
): number | null {
  const dx = line.end.x - line.start.x;
  const dy = line.end.y - line.start.y;
  const length = Math.hypot(dx, dy);
  if (length <= TOLERANCE.geometric) {
    return null;
  }
  return ((point.x - line.start.x) * dy - (point.y - line.start.y) * dx) / length;
}

/** Which endpoint of `line` is nearer the parent-line intersection (filleted corner). */
export function nearEndpointRoleForFillet(
  line: LineGeometry,
  partner: LineGeometry,
  fallback: Point2D,
): "start" | "end" {
  const hit = intersectInfiniteLines(
    line.start,
    line.end,
    partner.start,
    partner.end,
    TOLERANCE.coincidence,
  );
  const corner = hit?.point ?? fallback;
  return distance(line.start, corner) <= distance(line.end, corner)
    ? "start"
    : "end";
}

export function lineEndpoint(
  line: LineGeometry,
  which: "start" | "end",
): Point2D {
  return which === "start"
    ? { x: line.start.x, y: line.start.y }
    : { x: line.end.x, y: line.end.y };
}

/**
 * Signed distance along `line` from `point` to the projection of `target`
 * onto the infinite line. Zero when `point` is at the tangent foot of `target`.
 * (Line endpoints already lie on the line, so glue is 1-DOF, not 2D.)
 */
export function alongLineGlueResidual(
  point: Point2D,
  target: Point2D,
  line: LineGeometry,
): number | null {
  const dx = line.end.x - line.start.x;
  const dy = line.end.y - line.start.y;
  const length = Math.hypot(dx, dy);
  if (length <= TOLERANCE.geometric) {
    return null;
  }
  const foot = projectPointOntoLine(target, line.start, line.end);
  return ((point.x - foot.x) * dx + (point.y - foot.y) * dy) / length;
}

/**
 * Resync fillet arc angles from center to the current parent tangent points
 * (projections of the center onto each parent). Preserves sweep sense when possible.
 */
export function syncFilletArcAngles(sketch: Sketch): Sketch {
  let changed = false;
  const geometry = sketch.geometry.map((entity) => {
    if (entity.type !== "arc") {
      return entity;
    }
    const feature = findFilletForArc(sketch, entity.id);
    if (feature === null) {
      return entity;
    }
    const line1 = findLine(sketch, feature.line1Id);
    const line2 = findLine(sketch, feature.line2Id);
    if (line1 === null || line2 === null) {
      return entity;
    }
    const t1 = projectPointOntoLine(entity.center, line1.start, line1.end);
    const t2 = projectPointOntoLine(entity.center, line2.start, line2.end);
    if (
      distance(entity.center, t1) <= TOLERANCE.geometric ||
      distance(entity.center, t2) <= TOLERANCE.geometric
    ) {
      return entity;
    }
    const a1 = angleFromTo(entity.center, t1);
    const a2 = angleFromTo(entity.center, t2);
    const ordered = orderAnglesNearCurrent(
      a1,
      a2,
      entity.startAngle,
      entity.endAngle,
    );
    if (
      Math.abs(ordered.startAngle - entity.startAngle) <= TOLERANCE.angular &&
      Math.abs(ordered.endAngle - entity.endAngle) <= TOLERANCE.angular
    ) {
      return entity;
    }
    changed = true;
    return {
      ...entity,
      startAngle: ordered.startAngle,
      endAngle: ordered.endAngle,
    } satisfies ArcGeometry;
  });

  return changed ? { ...sketch, geometry } : sketch;
}

function findFilletForArc(
  sketch: Sketch,
  arcId: string,
): FilletFeatureIds | null {
  for (const constraint of sketch.constraints) {
    const feature = parseFilletFeature(constraint);
    if (feature !== null && feature.arcId === arcId) {
      return feature;
    }
  }
  return null;
}

function findLine(sketch: Sketch, id: string): LineGeometry | null {
  const entity = sketch.geometry.find((item) => item.id === id);
  return entity?.type === "line" ? entity : null;
}

function orderAnglesNearCurrent(
  a1: number,
  a2: number,
  currentStart: number,
  currentEnd: number,
): { readonly startAngle: number; readonly endAngle: number } {
  const score12 =
    angleDiff(a1, currentStart) + angleDiff(a2, currentEnd);
  const score21 =
    angleDiff(a2, currentStart) + angleDiff(a1, currentEnd);
  return score12 <= score21
    ? { startAngle: a1, endAngle: a2 }
    : { startAngle: a2, endAngle: a1 };
}

function angleDiff(a: number, b: number): number {
  let d = Math.abs(a - b) % (Math.PI * 2);
  if (d > Math.PI) {
    d = Math.PI * 2 - d;
  }
  return d;
}
