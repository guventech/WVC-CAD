import type { EntityId } from "../model/Geometry.ts";
import type { Sketch } from "../model/Sketch.ts";
import {
  applyMirror,
  type MirrorAxis,
  type MirrorFailureReason,
} from "../geometry/MirrorOps.ts";
import type { SketchCommand } from "./Command.ts";

export type MirrorCommandOutcome =
  | { readonly ok: true; readonly command: SketchCommand; readonly mirroredIds: readonly EntityId[] }
  | { readonly ok: false; readonly reason: MirrorFailureReason };

export function createMirrorCommand(
  sketch: Sketch,
  selectedIds: readonly EntityId[],
  axis: MirrorAxis,
): MirrorCommandOutcome {
  const outcome = applyMirror(sketch, selectedIds, axis);
  if (!outcome.ok) {
    return outcome;
  }

  const previousGeometry = sketch.geometry;
  const previousConstraints = sketch.constraints;
  const nextGeometry = outcome.sketch.geometry;
  const nextConstraints = outcome.sketch.constraints;

  return {
    ok: true,
    mirroredIds: outcome.mirroredIds,
    command: {
      label: `Mirror ${outcome.mirroredIds.length} entit${outcome.mirroredIds.length === 1 ? "y" : "ies"}`,
      apply(current) {
        return {
          ...current,
          geometry: nextGeometry,
          constraints: nextConstraints,
        };
      },
      undo(current) {
        return {
          ...current,
          geometry: previousGeometry,
          constraints: previousConstraints,
        };
      },
    },
  };
}
