import type { Constraint, ConstraintReference } from "../model/Constraint.ts";
import type { ArcGeometry, CircleGeometry, LineGeometry } from "../model/Geometry.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import { distance } from "../geometry/GeometryMath.ts";
import type { Sketch } from "../model/Sketch.ts";
import { findEntity } from "./ConstraintRef.ts";

export type EqualPair =
  | {
      readonly kind: "length";
      readonly first: ConstraintReference;
      readonly second: ConstraintReference;
    }
  | {
      readonly kind: "radius";
      readonly first: ConstraintReference;
      readonly second: ConstraintReference;
    };

/**
 * Two distinct user lines (equal length) or two circles/arcs (equal radius).
 * Mixed line↔curve and world axes are rejected.
 */
export function equalPair(
  sketch: Sketch,
  references: readonly ConstraintReference[],
): EqualPair | null {
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

  const lineA = resolveUserLine(sketch, rawA);
  const lineB = resolveUserLine(sketch, rawB);
  if (lineA !== null && lineB !== null) {
    return {
      kind: "length",
      first: { entityId: rawA.entityId, role: "entity" },
      second: { entityId: rawB.entityId, role: "entity" },
    };
  }

  const curveA = resolveCurve(sketch, rawA);
  const curveB = resolveCurve(sketch, rawB);
  if (curveA !== null && curveB !== null) {
    return {
      kind: "radius",
      first: { entityId: rawA.entityId, role: "entity" },
      second: { entityId: rawB.entityId, role: "entity" },
    };
  }

  return null;
}

/** Absolute size difference (mm). Null when unsupported. */
export function equalResidual(
  sketch: Sketch,
  constraint: Constraint,
): number | null {
  if (constraint.type !== "equal") {
    return null;
  }
  const pair = equalPair(sketch, constraint.references);
  if (pair === null) {
    return null;
  }
  const sizes = measureEqualSizes(sketch, pair);
  if (sizes === null) {
    return null;
  }
  return Math.abs(sizes.first - sizes.second);
}

/** Solver residual: size(A) − size(B). */
export function collectEqualResidualEquations(
  sketch: Sketch,
  constraint: Constraint,
): readonly { readonly constraintId: string; readonly value: number }[] {
  if (constraint.type !== "equal") {
    return [];
  }
  const pair = equalPair(sketch, constraint.references);
  if (pair === null) {
    return [];
  }
  const sizes = measureEqualSizes(sketch, pair);
  if (sizes === null) {
    return [];
  }
  return [
    { constraintId: constraint.id, value: sizes.first - sizes.second },
  ];
}

/** Canvas glyph between the two entities. */
export function equalAnnotationPoint(
  sketch: Sketch,
  constraint: Constraint,
): Point2D | null {
  if (constraint.type !== "equal") {
    return null;
  }
  const pair = equalPair(sketch, constraint.references);
  if (pair === null) {
    return null;
  }
  const a = entityAnchor(sketch, pair.first.entityId);
  const b = entityAnchor(sketch, pair.second.entityId);
  if (a === null || b === null) {
    return null;
  }
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function measureEqualSizes(
  sketch: Sketch,
  pair: EqualPair,
): { readonly first: number; readonly second: number } | null {
  if (pair.kind === "length") {
    const a = resolveUserLine(sketch, pair.first);
    const b = resolveUserLine(sketch, pair.second);
    if (a === null || b === null) {
      return null;
    }
    return {
      first: distance(a.start, a.end),
      second: distance(b.start, b.end),
    };
  }
  const a = resolveCurve(sketch, pair.first);
  const b = resolveCurve(sketch, pair.second);
  if (a === null || b === null) {
    return null;
  }
  return { first: a.radius, second: b.radius };
}

function resolveUserLine(
  sketch: Sketch,
  ref: ConstraintReference,
): LineGeometry | null {
  const entity = findEntity(sketch, ref.entityId);
  if (entity?.type !== "line") {
    return null;
  }
  if (ref.role !== "entity" && ref.role !== "object") {
    return null;
  }
  return entity;
}

function resolveCurve(
  sketch: Sketch,
  ref: ConstraintReference,
): CircleGeometry | ArcGeometry | null {
  const entity = findEntity(sketch, ref.entityId);
  if (entity?.type !== "circle" && entity?.type !== "arc") {
    return null;
  }
  return entity;
}

function entityAnchor(sketch: Sketch, entityId: string): Point2D | null {
  const entity = findEntity(sketch, entityId);
  if (entity === undefined) {
    return null;
  }
  if (entity.type === "line") {
    return {
      x: (entity.start.x + entity.end.x) / 2,
      y: (entity.start.y + entity.end.y) / 2,
    };
  }
  if (entity.type === "circle" || entity.type === "arc") {
    return entity.center;
  }
  return null;
}
