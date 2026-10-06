import { maintainConstraints } from "../constraints/ConstraintMaintenance.ts";
import type { PositionAnchor } from "../constraints/Coincident.ts";
import {
  handleKey,
  resolveLineObjectSegment,
} from "../constraints/ConstraintRef.ts";
import { validateConstraintStructure } from "../constraints/ConstraintValidator.ts";
import {
  distanceHandles,
  isSupportedDimensionType,
  measureDimension,
  validateDimensionValue,
  type SupportedDimensionType,
} from "../constraints/Dimensions.ts";
import {
  diagnoseAddConstraintConflict,
  type ConstraintConflict,
} from "../constraints/OverConstraint.ts";
import { orientationHandles, type OrientationType } from "../constraints/Orientation.ts";
import {
  lineRelationPair,
  type LineRelationType,
} from "../constraints/Parallel.ts";
import { classifyTangentPair } from "../constraints/Tangent.ts";
import { concentricPair } from "../constraints/Concentric.ts";
import { equalPair } from "../constraints/Equal.ts";
import { resolveMidpointTarget } from "../constraints/Midpoint.ts";
import { resolveSymmetricTarget } from "../constraints/Symmetric.ts";
import { resolvePointOnObjectTarget } from "../constraints/PointOnObject.ts";
import {
  fixLockMatchesTarget,
  isValidFixLock,
  measureFixLock,
  resolveFixTarget,
  type FixLock,
} from "../constraints/Fix.ts";
import type { Constraint, ConstraintReference } from "../model/Constraint.ts";
import { createEntityId } from "../model/EntityId.ts";
import { isDatumId } from "../model/SketchFrame.ts";
import type { Sketch } from "../model/Sketch.ts";
import type { SketchCommand } from "./Command.ts";

/** Request to add geometric or dimensional constraints via the pick tools. */
export interface ConstraintCreateRequest {
  readonly type:
    | OrientationType
    | LineRelationType
    | "tangent"
    | "concentric"
    | "midpoint"
    | "equal"
    | "symmetric"
    | "point-on-object"
    | SupportedDimensionType
    | "fix";
  readonly references: readonly ConstraintReference[];
  /** Dimension value (mm / radians). Defaults to the current measurement. */
  readonly value?: number;
  /** Dimensions only; default true (driving). */
  readonly driving?: boolean;
  /** Fix only; defaults from the current point/line/circle geometry. */
  readonly locked?: FixLock;
}

export type ConstraintCommandOutcome =
  | { readonly ok: true; readonly command: SketchCommand; readonly constraint: Constraint }
  | {
      readonly ok: false;
      readonly reason: string;
      readonly conflict?: ConstraintConflict;
    };

export type PrepareOutcome =
  | { readonly ok: true; readonly sketch: Sketch; readonly constraint: Constraint }
  | {
      readonly ok: false;
      readonly reason: string;
      readonly conflict?: ConstraintConflict;
    };

/**
 * Build the constraint, check duplicates/conflicts, insert it and run
 * provisional maintenance. Fails (sketch untouched) when maintenance cannot
 * satisfy every enforced constraint.
 */
export function prepareAddConstraint(
  sketch: Sketch,
  request: ConstraintCreateRequest,
  id: string = createEntityId(request.type),
): PrepareOutcome {
  const built = buildConstraint(sketch, request, id);
  if (!built.ok) {
    return built;
  }
  const { constraint } = built;

  const structure = validateConstraintStructure(sketch, constraint);
  if (!structure.ok) {
    return { ok: false, reason: structure.issues[0]?.message ?? "Invalid constraint." };
  }

  const duplicate = findDuplicateReason(sketch, constraint);
  if (duplicate !== null) {
    return {
      ok: false,
      reason: duplicate,
      conflict: {
        reason: duplicate,
        proposedConstraintId: constraint.id,
        conflictingConstraintIds: findDuplicateConflictIds(sketch, constraint),
      },
    };
  }

  const inserted = { ...sketch, constraints: [...sketch.constraints, constraint] };
  // Parallel/perpendicular between two user lines: pin the first-picked line so
  // the second follows. Skip when either ref is a world datum (the user line
  // must be free to rotate onto the axis).
  const anchors = lineRelationFollowAnchors(inserted, constraint);
  const maintained = maintainConstraints(inserted, anchors);
  if (!maintained.satisfied) {
    const conflict = diagnoseAddConstraintConflict(sketch, constraint);
    return { ok: false, reason: conflict.reason, conflict };
  }
  return { ok: true, sketch: maintained.sketch, constraint };
}

/** Anchor both endpoints of the first parallel/perp reference (user–user only). */
function lineRelationFollowAnchors(
  sketch: Sketch,
  constraint: Constraint,
): readonly PositionAnchor[] {
  if (constraint.type !== "parallel" && constraint.type !== "perpendicular") {
    return [];
  }
  const pair = lineRelationPair(sketch, constraint.references);
  if (pair === null) {
    return [];
  }
  if (
    isDatumId(sketch.frame, pair[0].entityId) ||
    isDatumId(sketch.frame, pair[1].entityId)
  ) {
    return [];
  }
  const segment = resolveLineObjectSegment(sketch, pair[0]);
  if (segment === null) {
    return [];
  }
  return [
    { ref: { entityId: pair[0].entityId, role: "start" }, position: { ...segment.start } },
    { ref: { entityId: pair[0].entityId, role: "end" }, position: { ...segment.end } },
  ];
}

export function createAddMaintainedConstraintCommand(
  sketch: Sketch,
  request: ConstraintCreateRequest,
  options?: { readonly id?: string },
): ConstraintCommandOutcome {
  const prepared = prepareAddConstraint(sketch, request, options?.id);
  if (!prepared.ok) {
    return prepared;
  }
  const { constraint } = prepared;
  const previousGeometry = sketch.geometry;
  const previousConstraints = sketch.constraints;

  return {
    ok: true,
    constraint,
    command: {
      label: `Add ${constraint.type} ${constraint.id}`,
      apply(current) {
        if (current.constraints.some((item) => item.id === constraint.id)) {
          return current;
        }
        const next = prepareAddConstraint(
          current,
          {
            ...request,
            value: constraint.value,
            driving: constraint.driving,
            locked: constraint.locked,
          },
          constraint.id,
        );
        return next.ok ? next.sketch : current;
      },
      undo(current) {
        return { ...current, geometry: previousGeometry, constraints: previousConstraints };
      },
    },
  };
}

function buildConstraint(
  sketch: Sketch,
  request: ConstraintCreateRequest,
  id: string,
): PrepareOutcome | { readonly ok: true; readonly constraint: Constraint } {
  if (request.type === "horizontal" || request.type === "vertical") {
    if (orientationHandles(sketch, request.references) === null) {
      return { ok: false, reason: "Pick a line, or two points/endpoints/centers." };
    }
    return {
      ok: true,
      constraint: { id, type: request.type, references: [...request.references] },
    };
  }

  if (request.type === "parallel" || request.type === "perpendicular") {
    const pair = lineRelationPair(sketch, request.references);
    if (pair === null) {
      return {
        ok: false,
        reason: "Pick two distinct lines (or a line and a world axis).",
      };
    }
    return {
      ok: true,
      constraint: { id, type: request.type, references: [...pair] },
    };
  }

  if (request.type === "tangent") {
    const pair = classifyTangentPair(sketch, request.references);
    if (pair === null) {
      return {
        ok: false,
        reason:
          "Pick a line and a circle/arc, or two circles/arcs (world axes allowed as lines).",
      };
    }
    const references =
      pair.kind === "line-curve"
        ? [pair.line, pair.curve]
        : [pair.first, pair.second];
    return {
      ok: true,
      constraint: { id, type: "tangent", references },
    };
  }

  if (request.type === "concentric") {
    const pair = concentricPair(sketch, request.references);
    if (pair === null) {
      return {
        ok: false,
        reason: "Pick two distinct circles or arcs.",
      };
    }
    return {
      ok: true,
      constraint: { id, type: "concentric", references: [...pair] },
    };
  }

  if (request.type === "midpoint") {
    const target = resolveMidpointTarget(sketch, request.references);
    if (target === null) {
      return {
        ok: false,
        reason:
          "Pick a point/endpoint/center and a line (not an endpoint of that line).",
      };
    }
    return {
      ok: true,
      constraint: {
        id,
        type: "midpoint",
        references: [target.point, target.line],
      },
    };
  }

  if (request.type === "equal") {
    const pair = equalPair(sketch, request.references);
    if (pair === null) {
      return {
        ok: false,
        reason:
          "Pick two lines (equal length) or two circles/arcs (equal radius).",
      };
    }
    return {
      ok: true,
      constraint: {
        id,
        type: "equal",
        references: [pair.first, pair.second],
      },
    };
  }

  if (request.type === "symmetric") {
    const target = resolveSymmetricTarget(sketch, request.references);
    if (target === null) {
      return {
        ok: false,
        reason:
          "Pick two distinct points/endpoints/centers and a mirror line or world axis.",
      };
    }
    return {
      ok: true,
      constraint: {
        id,
        type: "symmetric",
        references: [target.first, target.second, target.axis],
      },
    };
  }

  if (request.type === "point-on-object") {
    const target = resolvePointOnObjectTarget(sketch, request.references);
    if (target === null) {
      return {
        ok: false,
        reason:
          "Pick a point/endpoint/center and a line, circle, or arc (not a world axis).",
      };
    }
    return {
      ok: true,
      constraint: {
        id,
        type: "point-on-object",
        references: [target.point, target.object],
      },
    };
  }

  if (request.type === "fix") {
    const target = resolveFixTarget(sketch, request.references);
    if (target === null) {
      return {
        ok: false,
        reason:
          "Pick a point/endpoint/center, a line, or a circle/arc to fix (not a world datum).",
      };
    }
    const locked = request.locked ?? measureFixLock(sketch, [target.ref]);
    if (locked === null || !isValidFixLock(locked) || !fixLockMatchesTarget(target, locked)) {
      return { ok: false, reason: "Could not read the geometry to fix." };
    }
    return {
      ok: true,
      constraint: {
        id,
        type: "fix",
        references: [target.ref],
        locked: { ...locked },
      },
    };
  }

  if (!isSupportedDimensionType(request.type)) {
    return { ok: false, reason: "Unsupported dimension type." };
  }
  const measured = measureDimension(sketch, request.type, request.references);
  if (measured === null) {
    return { ok: false, reason: "Selection does not match this dimension type." };
  }
  const value = request.value ?? measured;
  const invalid = validateDimensionValue(request.type, value);
  if (invalid !== null) {
    return { ok: false, reason: invalid };
  }
  const driving = request.driving ?? true;
  return {
    ok: true,
    constraint: {
      id,
      type: request.type,
      references: [...request.references],
      value,
      driving,
    },
  };
}

/** Message when an equivalent (or directly contradictory) constraint exists. */
function findDuplicateReason(sketch: Sketch, constraint: Constraint): string | null {
  const signature = constraintSignature(sketch, constraint);
  if (signature === null) {
    return null;
  }
  for (const existing of sketch.constraints) {
    if (existing.id === constraint.id) {
      continue;
    }
    const other = constraintSignature(sketch, existing);
    if (other === null || other.handles !== signature.handles) {
      continue;
    }
    if (other.family === signature.family) {
      if (
        signature.family === "orientation" &&
        existing.type !== constraint.type
      ) {
        return "A line or point pair cannot be both horizontal and vertical. No changes were made.";
      }
      if (
        signature.family === "line-relation" &&
        existing.type !== constraint.type
      ) {
        return "Two lines cannot be both parallel and perpendicular. No changes were made.";
      }
      return `An equivalent ${existing.type} constraint already exists (${existing.id}). No changes were made.`;
    }
  }
  return null;
}

function findDuplicateConflictIds(
  sketch: Sketch,
  constraint: Constraint,
): string[] {
  const signature = constraintSignature(sketch, constraint);
  if (signature === null) {
    return [constraint.id];
  }
  const ids = [constraint.id];
  for (const existing of sketch.constraints) {
    if (existing.id === constraint.id) {
      continue;
    }
    const other = constraintSignature(sketch, existing);
    if (other === null || other.handles !== signature.handles) {
      continue;
    }
    if (other.family === signature.family) {
      ids.push(existing.id);
    }
  }
  return ids;
}

type ConstraintFamily =
  | "orientation"
  | "line-relation"
  | "tangent"
  | "concentric"
  | "midpoint"
  | "equal"
  | "symmetric"
  | "point-on-object"
  | "fix"
  | "length"
  | "h-distance"
  | "v-distance"
  | "size"
  | "angle"
  | "coordinate-x"
  | "coordinate-y";

function constraintSignature(
  sketch: Sketch,
  constraint: Constraint,
): { readonly family: ConstraintFamily; readonly handles: string } | null {
  switch (constraint.type) {
    case "horizontal":
    case "vertical": {
      const handles = orientationHandles(sketch, constraint.references);
      return handles === null ? null : { family: "orientation", handles: pairKey(handles) };
    }
    case "parallel":
    case "perpendicular": {
      const pair = lineRelationPair(sketch, constraint.references);
      return pair === null
        ? null
        : { family: "line-relation", handles: entityKey(pair) };
    }
    case "tangent": {
      const pair = classifyTangentPair(sketch, constraint.references);
      if (pair === null) {
        return null;
      }
      const refs =
        pair.kind === "line-curve"
          ? [pair.line, pair.curve]
          : [pair.first, pair.second];
      return { family: "tangent", handles: entityKey(refs) };
    }
    case "concentric": {
      const pair = concentricPair(sketch, constraint.references);
      return pair === null
        ? null
        : { family: "concentric", handles: entityKey(pair) };
    }
    case "midpoint": {
      const target = resolveMidpointTarget(sketch, constraint.references);
      return target === null
        ? null
        : {
            family: "midpoint",
            handles: `${handleKey(target.point)}|${target.line.entityId}`,
          };
    }
    case "equal": {
      const pair = equalPair(sketch, constraint.references);
      return pair === null
        ? null
        : { family: "equal", handles: entityKey([pair.first, pair.second]) };
    }
    case "symmetric": {
      const target = resolveSymmetricTarget(sketch, constraint.references);
      return target === null
        ? null
        : {
            family: "symmetric",
            handles: `${handleKey(target.first)}|${handleKey(target.second)}|${target.axis.entityId}`,
          };
    }
    case "point-on-object": {
      const target = resolvePointOnObjectTarget(sketch, constraint.references);
      return target === null
        ? null
        : {
            family: "point-on-object",
            handles: `${handleKey(target.point)}|${target.object.entityId}`,
          };
    }
    case "fix": {
      const target = resolveFixTarget(sketch, constraint.references);
      return target === null
        ? null
        : { family: "fix", handles: handleKey(target.ref) };
    }
    case "horizontal-distance":
    case "vertical-distance": {
      const handles = distanceHandles(sketch, constraint.references);
      if (handles === null) {
        return null;
      }
      return {
        family: constraint.type === "horizontal-distance" ? "h-distance" : "v-distance",
        handles: pairKey(handles),
      };
    }
    case "length":
      return { family: "length", handles: entityKey(constraint.references) };
    case "radius":
    case "diameter":
      return { family: "size", handles: entityKey(constraint.references) };
    case "angle":
      return { family: "angle", handles: entityKey(constraint.references) };
    case "coordinate-x":
    case "coordinate-y":
      return {
        family: constraint.type,
        handles: constraint.references.map((ref) => handleKey(ref)).join("|"),
      };
    default:
      return null;
  }
}

function pairKey(handles: readonly [ConstraintReference, ConstraintReference]): string {
  return [handleKey(handles[0]), handleKey(handles[1])].sort().join("|");
}

function entityKey(references: readonly ConstraintReference[]): string {
  return references.map((ref) => ref.entityId).sort().join("|");
}
