import type { Constraint, ConstraintReference } from "../model/Constraint.ts";
import type { ArcGeometry, CircleGeometry, LineGeometry } from "../model/Geometry.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import {
  angleFromTo,
  closestPointOnSegment,
  distance,
  distancePointToSegment,
  isAngleInArcSweep,
  normalizeAngle,
  TOLERANCE,
} from "../geometry/GeometryMath.ts";
import type { Sketch } from "../model/Sketch.ts";
import {
  findEntity,
  isPointLikeReference,
  normalizePointLikeRef,
  resolveConstraintPoint,
} from "./ConstraintRef.ts";
import { findFrameAxis } from "../model/SketchFrame.ts";

export type PointOnObjectTarget =
  | {
      readonly kind: "line";
      readonly point: ConstraintReference;
      readonly object: ConstraintReference;
    }
  | {
      readonly kind: "circle";
      readonly point: ConstraintReference;
      readonly object: ConstraintReference;
    }
  | {
      readonly kind: "arc";
      readonly point: ConstraintReference;
      readonly object: ConstraintReference;
    };

/**
 * Point-like handle on a user line segment, circle rim, or arc rim.
 * World axes are rejected (use coincident for datums).
 */
export function resolvePointOnObjectTarget(
  sketch: Sketch,
  references: readonly ConstraintReference[],
): PointOnObjectTarget | null {
  if (references.length !== 2) {
    return null;
  }
  const [rawA, rawB] = references;
  if (rawA === undefined || rawB === undefined) {
    return null;
  }

  let pointRef: ConstraintReference | null = null;
  let objectRef: ConstraintReference | null = null;

  if (isPointLikeReference(sketch, rawA) && isOnObjectEntity(sketch, rawB)) {
    pointRef = normalizePointLikeRef(sketch, rawA);
    objectRef = normalizeObjectRef(sketch, rawB);
  } else if (
    isPointLikeReference(sketch, rawB) &&
    isOnObjectEntity(sketch, rawA)
  ) {
    pointRef = normalizePointLikeRef(sketch, rawB);
    objectRef = normalizeObjectRef(sketch, rawA);
  } else {
    return null;
  }

  if (pointRef === null || objectRef === null) {
    return null;
  }
  if (resolveConstraintPoint(sketch, pointRef) === null) {
    return null;
  }

  const entity = findEntity(sketch, objectRef.entityId);
  if (entity?.type === "line") {
    return { kind: "line", point: pointRef, object: objectRef };
  }
  if (entity?.type === "circle") {
    return { kind: "circle", point: pointRef, object: objectRef };
  }
  if (entity?.type === "arc") {
    return { kind: "arc", point: pointRef, object: objectRef };
  }
  return null;
}

/** Distance to the object (mm). Null when unsupported. */
export function pointOnObjectResidual(
  sketch: Sketch,
  constraint: Constraint,
): number | null {
  if (constraint.type !== "point-on-object") {
    return null;
  }
  const target = resolvePointOnObjectTarget(sketch, constraint.references);
  if (target === null) {
    return null;
  }
  const point = resolveConstraintPoint(sketch, target.point);
  if (point === null) {
    return null;
  }

  if (target.kind === "line") {
    const line = userLine(sketch, target.object);
    if (line === null) {
      return null;
    }
    return distancePointToSegment(point, line.start, line.end);
  }

  if (target.kind === "circle") {
    const circle = userCircle(sketch, target.object);
    if (circle === null) {
      return null;
    }
    return Math.abs(distance(point, circle.center) - circle.radius);
  }

  const arc = userArc(sketch, target.object);
  if (arc === null) {
    return null;
  }
  const radial = Math.abs(distance(point, arc.center) - arc.radius);
  const angle = angleFromTo(arc.center, point);
  const angular = arcSweepViolation(angle, arc.startAngle, arc.endAngle);
  return Math.hypot(radial, angular * arc.radius);
}

export function collectPointOnObjectResidualEquations(
  sketch: Sketch,
  constraint: Constraint,
): readonly { readonly constraintId: string; readonly value: number }[] {
  if (constraint.type !== "point-on-object") {
    return [];
  }
  const target = resolvePointOnObjectTarget(sketch, constraint.references);
  if (target === null) {
    return [];
  }
  const point = resolveConstraintPoint(sketch, target.point);
  if (point === null) {
    return [];
  }

  if (target.kind === "line") {
    const line = userLine(sketch, target.object);
    if (line === null) {
      return [];
    }
    const foot = closestPointOnSegment(point, line.start, line.end);
    return [
      { constraintId: constraint.id, value: point.x - foot.x },
      { constraintId: constraint.id, value: point.y - foot.y },
    ];
  }

  if (target.kind === "circle") {
    const circle = userCircle(sketch, target.object);
    if (circle === null) {
      return [];
    }
    const d = distance(point, circle.center);
    return [{ constraintId: constraint.id, value: d - circle.radius }];
  }

  const arc = userArc(sketch, target.object);
  if (arc === null) {
    return [];
  }
  const d = distance(point, arc.center);
  const out: { readonly constraintId: string; readonly value: number }[] = [
    { constraintId: constraint.id, value: d - arc.radius },
  ];
  const angle = angleFromTo(arc.center, point);
  const violation = arcSweepViolation(angle, arc.startAngle, arc.endAngle);
  if (violation > TOLERANCE.geometric) {
    out.push({ constraintId: constraint.id, value: violation * arc.radius });
  }
  return out;
}

/** Canvas glyph at the closest point on the object. */
export function pointOnObjectAnnotationPoint(
  sketch: Sketch,
  constraint: Constraint,
): Point2D | null {
  if (constraint.type !== "point-on-object") {
    return null;
  }
  const target = resolvePointOnObjectTarget(sketch, constraint.references);
  if (target === null) {
    return null;
  }
  const point = resolveConstraintPoint(sketch, target.point);
  if (point === null) {
    return null;
  }

  if (target.kind === "line") {
    const line = userLine(sketch, target.object);
    if (line === null) {
      return null;
    }
    return closestPointOnSegment(point, line.start, line.end);
  }

  if (target.kind === "circle") {
    const circle = userCircle(sketch, target.object);
    if (circle === null) {
      return null;
    }
    const d = distance(point, circle.center);
    if (d <= TOLERANCE.geometric) {
      return point;
    }
    const scale = circle.radius / d;
    return {
      x: circle.center.x + (point.x - circle.center.x) * scale,
      y: circle.center.y + (point.y - circle.center.y) * scale,
    };
  }

  const arc = userArc(sketch, target.object);
  if (arc === null) {
    return null;
  }
  const d = distance(point, arc.center);
  if (d <= TOLERANCE.geometric) {
    return point;
  }
  const scale = arc.radius / d;
  return {
    x: arc.center.x + (point.x - arc.center.x) * scale,
    y: arc.center.y + (point.y - arc.center.y) * scale,
  };
}

/** Radians outside the CCW arc sweep (0 when inside). */
export function arcSweepViolation(
  angle: number,
  startAngle: number,
  endAngle: number,
): number {
  if (isAngleInArcSweep(angle, startAngle, endAngle)) {
    return 0;
  }
  const a = normalizeAngle(angle);
  const s = normalizeAngle(startAngle);
  const e = normalizeAngle(endAngle);
  return Math.min(angularDistance(a, s), angularDistance(a, e));
}

function angularDistance(a: number, b: number): number {
  const diff = Math.abs(a - b);
  return Math.min(diff, Math.PI * 2 - diff);
}

function isOnObjectEntity(
  sketch: Sketch,
  ref: ConstraintReference,
): boolean {
  if (findFrameAxis(sketch.frame, ref.entityId) !== null) {
    return false;
  }
  const entity = findEntity(sketch, ref.entityId);
  if (entity === undefined) {
    return false;
  }
  if (entity.type === "line") {
    return ref.role === "entity" || ref.role === "object";
  }
  if (entity.type === "circle" || entity.type === "arc") {
    return ref.role === "entity" || ref.role === "object";
  }
  return false;
}

function normalizeObjectRef(
  sketch: Sketch,
  ref: ConstraintReference,
): ConstraintReference | null {
  if (!isOnObjectEntity(sketch, ref)) {
    return null;
  }
  return { entityId: ref.entityId, role: "entity" };
}

function userLine(
  sketch: Sketch,
  ref: ConstraintReference,
): LineGeometry | null {
  const entity = findEntity(sketch, ref.entityId);
  return entity?.type === "line" ? entity : null;
}

function userCircle(
  sketch: Sketch,
  ref: ConstraintReference,
): CircleGeometry | null {
  const entity = findEntity(sketch, ref.entityId);
  return entity?.type === "circle" ? entity : null;
}

function userArc(
  sketch: Sketch,
  ref: ConstraintReference,
): ArcGeometry | null {
  const entity = findEntity(sketch, ref.entityId);
  return entity?.type === "arc" ? entity : null;
}
