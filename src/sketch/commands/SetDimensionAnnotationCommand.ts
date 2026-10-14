import type { Point2D } from "../geometry/Point2D.ts";
import type { Constraint, ConstraintId } from "../model/Constraint.ts";
import { isDimensionalConstraintType } from "../model/Constraint.ts";
import type { Sketch } from "../model/Sketch.ts";
import { constrainDimensionAnnotationOffset } from "../viewport/dimensionAnnotationOffset.ts";
import type { SketchCommand } from "./Command.ts";

export type SetDimensionAnnotationOutcome =
  | { readonly ok: true; readonly command: SketchCommand }
  | { readonly ok: false; readonly reason: string };

/**
 * Move a dimension annotation set in the view (presentation only — not a solver edit).
 * Offset is axis-constrained (horizontal dims → ±Y, vertical → ±X).
 */
export function createSetDimensionAnnotationCommand(
  sketch: Sketch,
  constraintId: ConstraintId,
  labelOffset: Point2D,
): SetDimensionAnnotationOutcome {
  const constraint = sketch.constraints.find((item) => item.id === constraintId);
  if (constraint === undefined) {
    return { ok: false, reason: "Dimension not found." };
  }
  if (!isDimensionalConstraintType(constraint.type)) {
    return { ok: false, reason: "Only dimensional constraints have movable labels." };
  }

  const before = constraint.annotation?.labelOffset
    ? constrainDimensionAnnotationOffset(sketch, constraint, {
        ...constraint.annotation.labelOffset,
      })
    : undefined;
  const after = constrainDimensionAnnotationOffset(sketch, constraint, labelOffset);
  if (
    before !== undefined &&
    Math.abs(before.x - after.x) < 1e-12 &&
    Math.abs(before.y - after.y) < 1e-12
  ) {
    return { ok: false, reason: "Label position unchanged." };
  }

  return {
    ok: true,
    command: {
      label: "Move dimension label",
      apply(current) {
        return withLabelOffset(current, constraintId, after);
      },
      undo(current) {
        return withLabelOffset(current, constraintId, before);
      },
    },
  };
}

function withLabelOffset(
  sketch: Sketch,
  constraintId: ConstraintId,
  labelOffset: Point2D | undefined,
): Sketch {
  let changed = false;
  const constraints = sketch.constraints.map((constraint) => {
    if (constraint.id !== constraintId) {
      return constraint;
    }
    changed = true;
    return setConstraintLabelOffset(constraint, labelOffset);
  });
  if (!changed) {
    return sketch;
  }
  return { ...sketch, constraints };
}

function setConstraintLabelOffset(
  constraint: Constraint,
  labelOffset: Point2D | undefined,
): Constraint {
  if (labelOffset === undefined) {
    if (constraint.annotation === undefined) {
      return constraint;
    }
    const { annotation: _drop, ...rest } = constraint;
    return rest;
  }
  return {
    ...constraint,
    annotation: {
      ...constraint.annotation,
      labelOffset: { x: labelOffset.x, y: labelOffset.y },
    },
  };
}
