import type { Constraint, ConstraintReference } from "../model/Constraint.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import { TOLERANCE } from "../geometry/GeometryMath.ts";
import type { Sketch } from "../model/Sketch.ts";
import {
  isLineObjectReference,
  resolveLineObjectSegment,
} from "./ConstraintRef.ts";

export type LineRelationType = "parallel" | "perpendicular";

export function isLineRelationType(type: string): type is LineRelationType {
  return type === "parallel" || type === "perpendicular";
}

/**
 * Two distinct line (or world-axis) object references for parallel / perpendicular.
 */
export function lineRelationPair(
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
    !isLineObjectReference(sketch, rawA) ||
    !isLineObjectReference(sketch, rawB) ||
    rawA.entityId === rawB.entityId
  ) {
    return null;
  }
  if (
    unitDirection(sketch, rawA) === null ||
    unitDirection(sketch, rawB) === null
  ) {
    return null;
  }
  return [
    { entityId: rawA.entityId, role: "entity" },
    { entityId: rawB.entityId, role: "entity" },
  ];
}

/** Unit direction of a line or world axis; null when degenerate. */
export function unitDirection(
  sketch: Sketch,
  ref: ConstraintReference,
): Point2D | null {
  const segment = resolveLineObjectSegment(sketch, ref);
  if (segment === null) {
    return null;
  }
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const length = Math.hypot(dx, dy);
  if (length <= TOLERANCE.geometric) {
    return null;
  }
  return { x: dx / length, y: dy / length };
}

/**
 * Diagnosis residual: |sin θ| for parallel, |cos θ| for perpendicular.
 * Null when unsupported. Compare with {@link TOLERANCE.angular}.
 */
export function lineRelationResidual(
  sketch: Sketch,
  constraint: Constraint,
): number | null {
  if (!isLineRelationType(constraint.type)) {
    return null;
  }
  const equations = collectLineRelationResidualEquations(sketch, constraint);
  if (equations.length === 0) {
    return null;
  }
  return Math.abs(equations[0]!.value);
}

/** Signed solver residual: sin θ (parallel) or cos θ (perpendicular). */
export function collectLineRelationResidualEquations(
  sketch: Sketch,
  constraint: Constraint,
): readonly { readonly constraintId: string; readonly value: number }[] {
  if (!isLineRelationType(constraint.type)) {
    return [];
  }
  const pair = lineRelationPair(sketch, constraint.references);
  if (pair === null) {
    return [];
  }
  const a = unitDirection(sketch, pair[0]);
  const b = unitDirection(sketch, pair[1]);
  if (a === null || b === null) {
    return [];
  }
  const cross = a.x * b.y - a.y * b.x;
  const dot = a.x * b.x + a.y * b.y;
  return [
    {
      constraintId: constraint.id,
      value: constraint.type === "parallel" ? cross : dot,
    },
  ];
}

/** Canvas glyph anchor: midpoint between the two segment midpoints. */
export function lineRelationAnnotationPoint(
  sketch: Sketch,
  constraint: Constraint,
): Point2D | null {
  const pair = lineRelationPair(sketch, constraint.references);
  if (pair === null) {
    return null;
  }
  const a = resolveLineObjectSegment(sketch, pair[0]);
  const b = resolveLineObjectSegment(sketch, pair[1]);
  if (a === null || b === null) {
    return null;
  }
  const midA = {
    x: (a.start.x + a.end.x) / 2,
    y: (a.start.y + a.end.y) / 2,
  };
  const midB = {
    x: (b.start.x + b.end.x) / 2,
    y: (b.start.y + b.end.y) / 2,
  };
  return {
    x: (midA.x + midB.x) / 2,
    y: (midA.y + midB.y) / 2,
  };
}
