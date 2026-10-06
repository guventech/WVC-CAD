import { validateConstraintStructure } from "../constraints/ConstraintValidator.ts";
import type { Constraint } from "../model/Constraint.ts";
import type { Sketch } from "../model/Sketch.ts";
import type { SketchCommand } from "./Command.ts";

/**
 * Undoable structural insert of a constraint record.
 * Geometric merge for coincident uses `createAddCoincidentCommand`.
 */
export function createAddConstraintCommand(
  constraint: Constraint,
): SketchCommand {
  return {
    label: `Add constraint ${constraint.id}`,
    apply(sketch) {
      return addConstraintToSketch(sketch, constraint);
    },
    undo(sketch) {
      return removeConstraintFromSketch(sketch, constraint.id);
    },
  };
}

export function addConstraintToSketch(
  sketch: Sketch,
  constraint: Constraint,
): Sketch {
  if (sketch.constraints.some((item) => item.id === constraint.id)) {
    return sketch;
  }

  const validation = validateConstraintStructure(sketch, constraint);
  if (!validation.ok) {
    return sketch;
  }

  return {
    ...sketch,
    constraints: [...sketch.constraints, constraint],
  };
}

export function removeConstraintFromSketch(
  sketch: Sketch,
  constraintId: string,
): Sketch {
  const next = sketch.constraints.filter((item) => item.id !== constraintId);
  if (next.length === sketch.constraints.length) {
    return sketch;
  }
  return {
    ...sketch,
    constraints: next,
  };
}
