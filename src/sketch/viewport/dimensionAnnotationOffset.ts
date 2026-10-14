import { resolveConstraintPoint } from "../constraints/ConstraintRef.ts";
import {
  distanceHandles,
  referencedLine,
} from "../constraints/Dimensions.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import type { Constraint, ConstraintId } from "../model/Constraint.ts";
import { isDimensionalConstraintType } from "../model/Constraint.ts";
import type { Sketch } from "../model/Sketch.ts";

/**
 * Unit world-space axis along which a dimension annotation set may move.
 * Horizontal dims → ±Y (up/down). Vertical dims → ±X (left/right).
 * Diagonal length/distance → perpendicular to the measured segment.
 * Returns null when motion stays free (radius / diameter / angle).
 */
export function dimensionAnnotationMoveAxis(
  sketch: Sketch,
  constraint: Constraint,
): Point2D | null {
  switch (constraint.type) {
    case "horizontal-distance":
    case "coordinate-x":
      return { x: 0, y: 1 };
    case "vertical-distance":
    case "coordinate-y":
      return { x: 1, y: 0 };
    case "length": {
      const line = referencedLine(sketch, constraint.references[0]);
      return line === null ? null : unitPerpendicular(line.start, line.end);
    }
    case "distance": {
      const handles = distanceHandles(sketch, constraint.references);
      if (handles === null) {
        return null;
      }
      const a = resolveConstraintPoint(sketch, handles[0]);
      const b = resolveConstraintPoint(sketch, handles[1]);
      if (a === null || b === null) {
        return null;
      }
      return unitPerpendicular(a, b);
    }
    default:
      return null;
  }
}

/**
 * Project a world-mm label offset onto the dimension's allowed move axis.
 * Free dims (axis null) keep the offset unchanged.
 */
export function constrainDimensionAnnotationOffset(
  sketch: Sketch,
  constraint: Constraint,
  offset: Point2D,
): Point2D {
  const axis = dimensionAnnotationMoveAxis(sketch, constraint);
  if (axis === null) {
    return { x: offset.x, y: offset.y };
  }
  const t = offset.x * axis.x + offset.y * axis.y;
  return { x: axis.x * t, y: axis.y * t };
}

/** Resolve the presentation offset for a constraint (override → stored → none). */
export function resolveDimensionAnnotationOffset(
  sketch: Sketch,
  constraintId: ConstraintId,
  overrides?: ReadonlyMap<ConstraintId, Point2D>,
): Point2D | undefined {
  const constraint = sketch.constraints.find((item) => item.id === constraintId);
  if (constraint === undefined || !isDimensionalConstraintType(constraint.type)) {
    return undefined;
  }
  const raw =
    overrides?.get(constraintId) ?? constraint.annotation?.labelOffset;
  if (raw === undefined) {
    return undefined;
  }
  return constrainDimensionAnnotationOffset(sketch, constraint, raw);
}

/** CCW unit perpendicular of A→B (same convention as linear leaders). */
export function unitPerpendicular(a: Point2D, b: Point2D): Point2D | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (!(len > 1e-9)) {
    return null;
  }
  return { x: -dy / len, y: dx / len };
}
