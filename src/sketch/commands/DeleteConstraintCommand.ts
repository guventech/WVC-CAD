import type { Sketch } from "../model/Sketch.ts";
import type { SketchCommand } from "./Command.ts";
import { removeConstraintFromSketch } from "./AddConstraintCommand.ts";

/**
 * Undoable removal of a single constraint record.
 * Geometry is left unchanged; feature markers may be removed without deleting entities.
 */
export function createDeleteConstraintCommand(
  sketch: Sketch,
  constraintId: string,
): SketchCommand | null {
  const index = sketch.constraints.findIndex((item) => item.id === constraintId);
  if (index < 0) {
    return null;
  }

  const previousConstraints = sketch.constraints;

  return {
    label: `Delete constraint ${constraintId}`,
    apply(current) {
      return removeConstraintFromSketch(current, constraintId);
    },
    undo(current) {
      return {
        ...current,
        constraints: previousConstraints,
      };
    },
  };
}
