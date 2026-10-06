import type { Constraint, ConstraintReference } from "../model/Constraint.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import { distance } from "../geometry/GeometryMath.ts";
import { reflectPointAcrossLine } from "../geometry/MirrorMath.ts";
import type { Sketch } from "../model/Sketch.ts";
import {
  handleKey,
  isLineObjectReference,
  isPointLikeReference,
  normalizePointLikeRef,
  resolveConstraintPoint,
  resolveLineObjectSegment,
  sameConstraintRef,
} from "./ConstraintRef.ts";

export type SymmetricTarget = {
  readonly first: ConstraintReference;
  readonly second: ConstraintReference;
  readonly axis: ConstraintReference;
};

/**
 * Two distinct point-like handles mirrored across a line or world axis.
 * Pick order is free; refs are normalized to [point, point, axis].
 */
export function resolveSymmetricTarget(
  sketch: Sketch,
  references: readonly ConstraintReference[],
): SymmetricTarget | null {
  if (references.length !== 3) {
    return null;
  }

  const points: ConstraintReference[] = [];
  let axis: ConstraintReference | null = null;

  for (const raw of references) {
    if (isPointLikeReference(sketch, raw)) {
      points.push(normalizePointLikeRef(sketch, raw));
      continue;
    }
    if (isLineObjectReference(sketch, raw)) {
      if (axis !== null) {
        return null;
      }
      axis = { entityId: raw.entityId, role: "entity" };
      continue;
    }
    return null;
  }

  if (axis === null || points.length !== 2) {
    return null;
  }
  const [rawA, rawB] = points;
  if (rawA === undefined || rawB === undefined) {
    return null;
  }
  if (sameConstraintRef(rawA, rawB)) {
    return null;
  }
  if (
    resolveConstraintPoint(sketch, rawA) === null ||
    resolveConstraintPoint(sketch, rawB) === null ||
    resolveLineObjectSegment(sketch, axis) === null
  ) {
    return null;
  }

  // Stable point order for duplicate detection.
  const ordered =
    handleKey(rawA) <= handleKey(rawB)
      ? ([rawA, rawB] as const)
      : ([rawB, rawA] as const);

  return { first: ordered[0], second: ordered[1], axis };
}

/** Distance from second point to the reflection of the first (mm). */
export function symmetricResidual(
  sketch: Sketch,
  constraint: Constraint,
): number | null {
  if (constraint.type !== "symmetric") {
    return null;
  }
  const target = resolveSymmetricTarget(sketch, constraint.references);
  if (target === null) {
    return null;
  }
  const reflected = reflectedFirst(sketch, target);
  const second = resolveConstraintPoint(sketch, target.second);
  if (reflected === null || second === null) {
    return null;
  }
  return distance(reflected, second);
}

/** Solver residuals: reflect(first) − second (Δx, Δy). */
export function collectSymmetricResidualEquations(
  sketch: Sketch,
  constraint: Constraint,
): readonly { readonly constraintId: string; readonly value: number }[] {
  if (constraint.type !== "symmetric") {
    return [];
  }
  const target = resolveSymmetricTarget(sketch, constraint.references);
  if (target === null) {
    return [];
  }
  const reflected = reflectedFirst(sketch, target);
  const second = resolveConstraintPoint(sketch, target.second);
  if (reflected === null || second === null) {
    return [];
  }
  return [
    { constraintId: constraint.id, value: reflected.x - second.x },
    { constraintId: constraint.id, value: reflected.y - second.y },
  ];
}

/** Canvas glyph between the two mirrored points. */
export function symmetricAnnotationPoint(
  sketch: Sketch,
  constraint: Constraint,
): Point2D | null {
  if (constraint.type !== "symmetric") {
    return null;
  }
  const target = resolveSymmetricTarget(sketch, constraint.references);
  if (target === null) {
    return null;
  }
  const a = resolveConstraintPoint(sketch, target.first);
  const b = resolveConstraintPoint(sketch, target.second);
  if (a === null || b === null) {
    return null;
  }
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function reflectedFirst(
  sketch: Sketch,
  target: SymmetricTarget,
): Point2D | null {
  const point = resolveConstraintPoint(sketch, target.first);
  const axis = resolveLineObjectSegment(sketch, target.axis);
  if (point === null || axis === null) {
    return null;
  }
  return reflectPointAcrossLine(point, axis.start, axis.end);
}
