import type { Constraint, ConstraintReference } from "../model/Constraint.ts";
import type { EntityId } from "../model/Geometry.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import { distance } from "../geometry/GeometryMath.ts";
import type { Sketch } from "../model/Sketch.ts";
import type { SnapCandidate } from "../selection/SnapTypes.ts";
import {
  findEntity,
  isPointLikeReference,
  normalizePointLikeRef,
  resolveConstraintPoint,
  sameConstraintRef,
} from "./ConstraintRef.ts";

/** Source line id when a creation snap is a midpoint pick; otherwise null. */
export function midpointSourceFromSnap(
  snap: SnapCandidate | null | undefined,
): EntityId | null {
  if (snap?.type !== "midpoint" || snap.sourceEntityId === undefined) {
    return null;
  }
  return snap.sourceEntityId;
}

export type MidpointTarget = {
  readonly point: ConstraintReference;
  readonly line: ConstraintReference;
};

/**
 * Point-like handle at the midpoint of a finite user line.
 * World axes are rejected (no meaningful segment midpoint).
 * Rejects when the point is an endpoint of that same line (would force zero length).
 */
export function resolveMidpointTarget(
  sketch: Sketch,
  references: readonly ConstraintReference[],
): MidpointTarget | null {
  if (references.length !== 2) {
    return null;
  }
  const [rawA, rawB] = references;
  if (rawA === undefined || rawB === undefined) {
    return null;
  }

  let pointRef: ConstraintReference | null = null;
  let lineRef: ConstraintReference | null = null;

  if (isPointLikeReference(sketch, rawA) && isUserLineEntity(sketch, rawB)) {
    pointRef = normalizePointLikeRef(sketch, rawA);
    lineRef = { entityId: rawB.entityId, role: "entity" };
  } else if (
    isPointLikeReference(sketch, rawB) &&
    isUserLineEntity(sketch, rawA)
  ) {
    pointRef = normalizePointLikeRef(sketch, rawB);
    lineRef = { entityId: rawA.entityId, role: "entity" };
  } else {
    return null;
  }

  if (resolveConstraintPoint(sketch, pointRef) === null) {
    return null;
  }
  if (userLineSegment(sketch, lineRef) === null) {
    return null;
  }

  // Endpoint of the same line ↔ that line would collapse the segment.
  const startRef = normalizePointLikeRef(sketch, {
    entityId: lineRef.entityId,
    role: "start",
  });
  const endRef = normalizePointLikeRef(sketch, {
    entityId: lineRef.entityId,
    role: "end",
  });
  if (
    sameConstraintRef(pointRef, startRef) ||
    sameConstraintRef(pointRef, endRef)
  ) {
    return null;
  }

  return { point: pointRef, line: lineRef };
}

/** Distance from the point to the segment midpoint (mm). */
export function midpointResidual(
  sketch: Sketch,
  constraint: Constraint,
): number | null {
  if (constraint.type !== "midpoint") {
    return null;
  }
  const target = resolveMidpointTarget(sketch, constraint.references);
  if (target === null) {
    return null;
  }
  const point = resolveConstraintPoint(sketch, target.point);
  const mid = lineMidpoint(sketch, target.line);
  if (point === null || mid === null) {
    return null;
  }
  return distance(point, mid);
}

/** Solver residuals: point − midpoint (Δx, Δy). */
export function collectMidpointResidualEquations(
  sketch: Sketch,
  constraint: Constraint,
): readonly { readonly constraintId: string; readonly value: number }[] {
  if (constraint.type !== "midpoint") {
    return [];
  }
  const target = resolveMidpointTarget(sketch, constraint.references);
  if (target === null) {
    return [];
  }
  const point = resolveConstraintPoint(sketch, target.point);
  const mid = lineMidpoint(sketch, target.line);
  if (point === null || mid === null) {
    return [];
  }
  return [
    { constraintId: constraint.id, value: point.x - mid.x },
    { constraintId: constraint.id, value: point.y - mid.y },
  ];
}

/** Canvas glyph at the line midpoint. */
export function midpointAnnotationPoint(
  sketch: Sketch,
  constraint: Constraint,
): Point2D | null {
  if (constraint.type !== "midpoint") {
    return null;
  }
  const target = resolveMidpointTarget(sketch, constraint.references);
  if (target === null) {
    return null;
  }
  return lineMidpoint(sketch, target.line);
}

function isUserLineEntity(
  sketch: Sketch,
  ref: ConstraintReference,
): boolean {
  const entity = findEntity(sketch, ref.entityId);
  return (
    entity?.type === "line" &&
    (ref.role === "entity" || ref.role === "object")
  );
}

function userLineSegment(
  sketch: Sketch,
  lineRef: ConstraintReference,
): { readonly start: Point2D; readonly end: Point2D } | null {
  const entity = findEntity(sketch, lineRef.entityId);
  if (entity?.type !== "line") {
    return null;
  }
  return { start: entity.start, end: entity.end };
}

function lineMidpoint(
  sketch: Sketch,
  lineRef: ConstraintReference,
): Point2D | null {
  const segment = userLineSegment(sketch, lineRef);
  if (segment === null) {
    return null;
  }
  return {
    x: (segment.start.x + segment.end.x) / 2,
    y: (segment.start.y + segment.end.y) / 2,
  };
}
