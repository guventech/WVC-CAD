import type { Constraint, ConstraintReference } from "../model/Constraint.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import { isDatumId } from "../model/SketchFrame.ts";
import type { Sketch } from "../model/Sketch.ts";
import {
  isPointLikeRole,
  resolveConstraintPoint,
} from "./ConstraintRef.ts";

/** Captured lock payload for a Fix constraint (point, line, or circle/arc). */
export type FixLock = {
  readonly x: number;
  readonly y: number;
  /** Line entity Fix: locked end point. */
  readonly endX?: number;
  readonly endY?: number;
  /** Circle/arc entity Fix: locked radius (mm). */
  readonly radius?: number;
};

export type FixTarget =
  | { readonly kind: "point"; readonly ref: ConstraintReference }
  | { readonly kind: "line"; readonly ref: ConstraintReference }
  | { readonly kind: "circle"; readonly ref: ConstraintReference };

/**
 * Resolve what the single Fix reference locks:
 * - point-like handle → world XY
 * - line entity → both endpoints
 * - circle/arc entity → center + radius
 */
export function resolveFixTarget(
  sketch: Sketch,
  references: readonly ConstraintReference[],
): FixTarget | null {
  if (references.length !== 1) {
    return null;
  }
  const ref = references[0]!;
  if (isDatumId(sketch.frame, ref.entityId)) {
    return null;
  }

  if (isPointLikeRole(ref.role)) {
    if (resolveConstraintPoint(sketch, ref) === null) {
      return null;
    }
    return { kind: "point", ref };
  }

  if (ref.role !== "entity") {
    return null;
  }
  const entity = sketch.geometry.find((item) => item.id === ref.entityId);
  if (entity?.type === "line") {
    return { kind: "line", ref };
  }
  if (entity?.type === "circle" || entity?.type === "arc") {
    return { kind: "circle", ref };
  }
  return null;
}

/** Capture lock values from current geometry for the Fix target. */
export function measureFixLock(
  sketch: Sketch,
  references: readonly ConstraintReference[],
): FixLock | null {
  const target = resolveFixTarget(sketch, references);
  if (target === null) {
    return null;
  }
  switch (target.kind) {
    case "point": {
      const point = resolveConstraintPoint(sketch, target.ref);
      return point === null ? null : { x: point.x, y: point.y };
    }
    case "line": {
      const line = sketch.geometry.find((item) => item.id === target.ref.entityId);
      if (line?.type !== "line") {
        return null;
      }
      return {
        x: line.start.x,
        y: line.start.y,
        endX: line.end.x,
        endY: line.end.y,
      };
    }
    case "circle": {
      const curve = sketch.geometry.find((item) => item.id === target.ref.entityId);
      if (curve?.type !== "circle" && curve?.type !== "arc") {
        return null;
      }
      return {
        x: curve.center.x,
        y: curve.center.y,
        radius: curve.radius,
      };
    }
  }
}

export function isValidFixLock(locked: FixLock | undefined): locked is FixLock {
  if (
    locked === undefined ||
    !Number.isFinite(locked.x) ||
    !Number.isFinite(locked.y)
  ) {
    return false;
  }
  const hasEnd = locked.endX !== undefined || locked.endY !== undefined;
  if (hasEnd) {
    return Number.isFinite(locked.endX) && Number.isFinite(locked.endY);
  }
  if (locked.radius !== undefined) {
    return Number.isFinite(locked.radius) && locked.radius > 0;
  }
  return true;
}

/** Lock matches the resolved target shape (point vs line vs circle). */
export function fixLockMatchesTarget(
  target: FixTarget,
  locked: FixLock,
): boolean {
  switch (target.kind) {
    case "point":
      return locked.endX === undefined && locked.radius === undefined;
    case "line":
      return (
        Number.isFinite(locked.endX) &&
        Number.isFinite(locked.endY) &&
        locked.radius === undefined
      );
    case "circle":
      return (
        locked.endX === undefined &&
        Number.isFinite(locked.radius) &&
        (locked.radius as number) > 0
      );
  }
}

/** Max absolute residual for the Fix (mm), or null if unsupported. */
export function fixResidual(
  sketch: Sketch,
  constraint: Constraint,
): number | null {
  const equations = collectFixResidualEquations(sketch, constraint);
  if (equations.length === 0) {
    return null;
  }
  let max = 0;
  for (const equation of equations) {
    const abs = Math.abs(equation.value);
    if (abs > max) {
      max = abs;
    }
  }
  return max;
}

/** Solver residual equations for a Fix constraint. */
export function collectFixResidualEquations(
  sketch: Sketch,
  constraint: Constraint,
): readonly { readonly constraintId: string; readonly value: number }[] {
  if (constraint.type !== "fix" || !isValidFixLock(constraint.locked)) {
    return [];
  }
  const target = resolveFixTarget(sketch, constraint.references);
  if (target === null || !fixLockMatchesTarget(target, constraint.locked)) {
    return [];
  }
  const locked = constraint.locked;
  const id = constraint.id;
  const out: { constraintId: string; value: number }[] = [];

  switch (target.kind) {
    case "point": {
      const point = resolveConstraintPoint(sketch, target.ref);
      if (point === null) {
        return [];
      }
      out.push({ constraintId: id, value: point.x - locked.x });
      out.push({ constraintId: id, value: point.y - locked.y });
      break;
    }
    case "line": {
      const line = sketch.geometry.find((item) => item.id === target.ref.entityId);
      if (line?.type !== "line") {
        return [];
      }
      out.push({ constraintId: id, value: line.start.x - locked.x });
      out.push({ constraintId: id, value: line.start.y - locked.y });
      out.push({ constraintId: id, value: line.end.x - locked.endX! });
      out.push({ constraintId: id, value: line.end.y - locked.endY! });
      break;
    }
    case "circle": {
      const curve = sketch.geometry.find((item) => item.id === target.ref.entityId);
      if (curve?.type !== "circle" && curve?.type !== "arc") {
        return [];
      }
      out.push({ constraintId: id, value: curve.center.x - locked.x });
      out.push({ constraintId: id, value: curve.center.y - locked.y });
      out.push({ constraintId: id, value: curve.radius - locked.radius! });
      break;
    }
  }
  return out;
}

/** Canvas glyph anchor for Fix. */
export function fixAnnotationPoint(
  sketch: Sketch,
  constraint: Constraint,
): Point2D | null {
  const target = resolveFixTarget(sketch, constraint.references);
  if (target === null) {
    return null;
  }
  switch (target.kind) {
    case "point":
      return resolveConstraintPoint(sketch, target.ref);
    case "line": {
      const line = sketch.geometry.find((item) => item.id === target.ref.entityId);
      if (line?.type !== "line") {
        return null;
      }
      return {
        x: (line.start.x + line.end.x) / 2,
        y: (line.start.y + line.end.y) / 2,
      };
    }
    case "circle": {
      const curve = sketch.geometry.find((item) => item.id === target.ref.entityId);
      if (curve?.type !== "circle" && curve?.type !== "arc") {
        return null;
      }
      return { x: curve.center.x, y: curve.center.y };
    }
  }
}
