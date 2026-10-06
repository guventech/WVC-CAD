import type { Constraint, ConstraintReference } from "../model/Constraint.ts";
import type { ArcGeometry, CircleGeometry } from "../model/Geometry.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import { distance } from "../geometry/GeometryMath.ts";
import type { Sketch } from "../model/Sketch.ts";
import { findEntity } from "./ConstraintRef.ts";

type CurveEntity = CircleGeometry | ArcGeometry;

/**
 * Two distinct circle/arc entity references for concentric.
 */
export function concentricPair(
  sketch: Sketch,
  references: readonly ConstraintReference[],
): readonly [ConstraintReference, ConstraintReference] | null {
  if (references.length !== 2) {
    return null;
  }
  const [rawA, rawB] = references;
  if (
    rawA === undefined ||
    rawB === undefined ||
    rawA.entityId === rawB.entityId
  ) {
    return null;
  }
  if (resolveCurve(sketch, rawA) === null || resolveCurve(sketch, rawB) === null) {
    return null;
  }
  return [
    { entityId: rawA.entityId, role: "entity" },
    { entityId: rawB.entityId, role: "entity" },
  ];
}

/** Center-to-center distance (mm). Null when unsupported. */
export function concentricResidual(
  sketch: Sketch,
  constraint: Constraint,
): number | null {
  if (constraint.type !== "concentric") {
    return null;
  }
  const pair = concentricPair(sketch, constraint.references);
  if (pair === null) {
    return null;
  }
  const a = resolveCurve(sketch, pair[0]);
  const b = resolveCurve(sketch, pair[1]);
  if (a === null || b === null) {
    return null;
  }
  return distance(a.center, b.center);
}

/** Solver residuals: Δx and Δy between centers. */
export function collectConcentricResidualEquations(
  sketch: Sketch,
  constraint: Constraint,
): readonly { readonly constraintId: string; readonly value: number }[] {
  if (constraint.type !== "concentric") {
    return [];
  }
  const pair = concentricPair(sketch, constraint.references);
  if (pair === null) {
    return [];
  }
  const a = resolveCurve(sketch, pair[0]);
  const b = resolveCurve(sketch, pair[1]);
  if (a === null || b === null) {
    return [];
  }
  return [
    { constraintId: constraint.id, value: a.center.x - b.center.x },
    { constraintId: constraint.id, value: a.center.y - b.center.y },
  ];
}

/** Canvas glyph at the shared-center location (average of the two centers). */
export function concentricAnnotationPoint(
  sketch: Sketch,
  constraint: Constraint,
): Point2D | null {
  if (constraint.type !== "concentric") {
    return null;
  }
  const pair = concentricPair(sketch, constraint.references);
  if (pair === null) {
    return null;
  }
  const a = resolveCurve(sketch, pair[0]);
  const b = resolveCurve(sketch, pair[1]);
  if (a === null || b === null) {
    return null;
  }
  return {
    x: (a.center.x + b.center.x) / 2,
    y: (a.center.y + b.center.y) / 2,
  };
}

function resolveCurve(
  sketch: Sketch,
  ref: ConstraintReference,
): CurveEntity | null {
  const entity = findEntity(sketch, ref.entityId);
  if (entity?.type !== "circle" && entity?.type !== "arc") {
    return null;
  }
  return entity;
}
