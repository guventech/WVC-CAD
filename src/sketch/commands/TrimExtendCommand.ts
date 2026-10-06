import type { EntityId } from "../model/Geometry.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import type { Sketch } from "../model/Sketch.ts";
import {
  applyExtendLine,
  applyTrimLine,
  type TrimExtendFailureReason,
} from "../geometry/TrimExtendOps.ts";
import type { SketchCommand } from "./Command.ts";

export type TrimExtendCommandOutcome =
  | { readonly ok: true; readonly command: SketchCommand }
  | { readonly ok: false; readonly reason: TrimExtendFailureReason };

export function createTrimCommand(
  sketch: Sketch,
  entityId: EntityId,
  clickWorld: Point2D,
): TrimExtendCommandOutcome {
  const outcome = applyTrimLine(sketch, entityId, clickWorld);
  if (!outcome.ok) {
    return outcome;
  }

  const previousGeometry = sketch.geometry;
  const previousConstraints = sketch.constraints;
  const nextGeometry = outcome.sketch.geometry;
  const nextConstraints = outcome.sketch.constraints;

  return {
    ok: true,
    command: {
      label: "Trim line",
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

export function createExtendCommand(
  sketch: Sketch,
  entityId: EntityId,
  clickWorld: Point2D,
): TrimExtendCommandOutcome {
  const outcome = applyExtendLine(sketch, entityId, clickWorld);
  if (!outcome.ok) {
    return outcome;
  }

  const previousGeometry = sketch.geometry;
  const previousConstraints = sketch.constraints;
  const nextGeometry = outcome.sketch.geometry;
  const nextConstraints = outcome.sketch.constraints;

  return {
    ok: true,
    command: {
      label: "Extend line",
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
