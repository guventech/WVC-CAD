import type { Constraint, ConstraintReference } from "../model/Constraint.ts";
import type { Sketch } from "../model/Sketch.ts";
import {
  findEntity,
  isLineObjectReference,
  isPointLikeReference,
  normalizePointLikeRef,
  resolveConstraintPoint,
  sameConstraintRef,
} from "./ConstraintRef.ts";

export type OrientationType = "horizontal" | "vertical";

export function isOrientationType(type: string): type is OrientationType {
  return type === "horizontal" || type === "vertical";
}

/**
 * The two point handles an orientation constraint relates.
 * Supported patterns: one line (`entity`/`object`) or two point-like handles.
 */
export function orientationHandles(
  sketch: Sketch,
  references: readonly ConstraintReference[],
): readonly [ConstraintReference, ConstraintReference] | null {
  if (references.length === 1) {
    const [lineRef] = references;
    if (lineRef === undefined || !isLineObjectReference(sketch, lineRef)) {
      return null;
    }
    return [
      normalizePointLikeRef(sketch, { entityId: lineRef.entityId, role: "start" }),
      normalizePointLikeRef(sketch, { entityId: lineRef.entityId, role: "end" }),
    ];
  }

  if (references.length === 2) {
    const [rawA, rawB] = references;
    if (
      rawA === undefined ||
      rawB === undefined ||
      !isPointLikeReference(sketch, rawA) ||
      !isPointLikeReference(sketch, rawB)
    ) {
      return null;
    }
    const a = normalizePointLikeRef(sketch, rawA);
    const b = normalizePointLikeRef(sketch, rawB);
    if (sameConstraintRef(a, b)) {
      return null;
    }
    return [a, b];
  }

  return null;
}

/** |Δy| for horizontal, |Δx| for vertical (mm). Null when unsupported. */
export function orientationResidual(
  sketch: Sketch,
  constraint: Constraint,
): number | null {
  if (!isOrientationType(constraint.type)) {
    return null;
  }
  const handles = orientationHandles(sketch, constraint.references);
  if (handles === null) {
    return null;
  }
  const a = resolveConstraintPoint(sketch, handles[0]);
  const b = resolveConstraintPoint(sketch, handles[1]);
  if (a === null || b === null) {
    return null;
  }
  return constraint.type === "horizontal"
    ? Math.abs(b.y - a.y)
    : Math.abs(b.x - a.x);
}

/** Line entity ids carrying a horizontal or vertical constraint. */
export function orientationLockedLineIds(sketch: Sketch): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const constraint of sketch.constraints) {
    if (!isOrientationType(constraint.type) || constraint.references.length !== 1) {
      continue;
    }
    const ref = constraint.references[0];
    if (ref !== undefined && findEntity(sketch, ref.entityId)?.type === "line") {
      ids.add(ref.entityId);
    }
  }
  return ids;
}
