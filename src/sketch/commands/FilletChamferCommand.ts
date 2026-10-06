import type { Sketch } from "../model/Sketch.ts";
import {
  applyChamferLines,
  applyFilletLines,
  type FilletChamferFailureReason,
} from "../geometry/FilletChamferOps.ts";
import type { SketchCommand } from "./Command.ts";
import type { FilletChamferRequest } from "../tools/FilletChamferTool.ts";

export type FilletChamferCommandOutcome =
  | { readonly ok: true; readonly command: SketchCommand }
  | { readonly ok: false; readonly reason: FilletChamferFailureReason };

export function createFilletCommand(
  sketch: Sketch,
  request: FilletChamferRequest,
): FilletChamferCommandOutcome {
  const outcome = applyFilletLines(
    sketch,
    request.line1Id,
    request.line2Id,
    request.pickPoint,
  );
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
      label: "Fillet",
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

export function createChamferCommand(
  sketch: Sketch,
  request: FilletChamferRequest,
): FilletChamferCommandOutcome {
  const outcome = applyChamferLines(
    sketch,
    request.line1Id,
    request.line2Id,
    request.pickPoint,
  );
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
      label: "Chamfer",
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
