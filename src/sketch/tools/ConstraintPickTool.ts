import type { ConstraintCreateRequest } from "../commands/AddMaintainedConstraintCommand.ts";
import { constraintPickFromHit } from "../constraints/pickConstraintRef.ts";
import {
  classifyDistancePicks,
  type DistancePick,
} from "../constraints/SmartDistance.ts";
import { classifyRadialPick } from "../constraints/SmartRadial.ts";
import type { ConstraintReference } from "../model/Constraint.ts";
import type { Sketch } from "../model/Sketch.ts";
import { hitTestSketch, type HitResult } from "../selection/HitTesting.ts";
import { selectEntityInSketch } from "../selection/selectInSketch.ts";
import type { ConstraintPickToolId } from "./ActiveTool.ts";
import type { ToolPointerContext, ToolPointerResult } from "./ToolTypes.ts";

export type ConstraintToolPick =
  | { readonly kind: "point-like"; readonly ref: ConstraintReference }
  | { readonly kind: "line"; readonly ref: ConstraintReference }
  | { readonly kind: "curve"; readonly ref: ConstraintReference }
  | { readonly kind: "on-object"; readonly ref: ConstraintReference };

export interface ConstraintPickToolState {
  readonly first: ConstraintToolPick | null;
  readonly second: ConstraintToolPick | null;
}

export function createConstraintPickToolState(): ConstraintPickToolState {
  return { first: null, second: null };
}

type PickStep =
  | { readonly kind: "create"; readonly request: ConstraintCreateRequest }
  | { readonly kind: "await-second"; readonly first: ConstraintToolPick }
  | {
      readonly kind: "await-third";
      readonly first: ConstraintToolPick;
      readonly second: ConstraintToolPick;
    }
  | { readonly kind: "ignore" };

/**
 * Pure pick interpretation per tool:
 * - H / V, H / V distance: a line, or two point-like handles
 * - Parallel / perpendicular: two distinct lines (or world axes)
 * - Tangent: line + circle/arc, or two circles/arcs
 * - Concentric: two circles/arcs
 * - Midpoint: point-like + line (either order)
 * - Equal: two lines (length) or two circles/arcs (radius)
 * - Symmetric: two point-like + one mirror line/axis (any order, three picks)
 * - Point-on-object: point-like + line/circle/arc object (either order)
 * - Fix: one point-like handle, line, or circle/arc
 * - axis offset: one point-like (or parallel line expanded by the pointer handler)
 * - distance: line (await second: same→length, other line/axis/point→smart);
 *   two points; point+axis for locate (replaces Offset X/Y tools)
 * - radial: circle → diameter (Shift → radius); arc → radius · angle: two lines
 */
export function interpretConstraintPick(
  tool: ConstraintPickToolId,
  first: ConstraintToolPick | null,
  pick: ConstraintToolPick,
  second: ConstraintToolPick | null = null,
  sketch: Sketch | null = null,
  preferRadius: boolean = false,
): PickStep {
  switch (tool) {
    case "fix":
      return pick.kind === "point-like" ||
        pick.kind === "line" ||
        pick.kind === "curve"
        ? { kind: "create", request: { type: "fix", references: [pick.ref] } }
        : { kind: "ignore" };
    case "parallel":
    case "perpendicular": {
      if (pick.kind !== "line") {
        return { kind: "ignore" };
      }
      if (first === null) {
        return { kind: "await-second", first: pick };
      }
      if (first.kind !== "line" || first.ref.entityId === pick.ref.entityId) {
        return { kind: "ignore" };
      }
      return {
        kind: "create",
        request: { type: tool, references: [first.ref, pick.ref] },
      };
    }
    case "tangent": {
      if (pick.kind !== "line" && pick.kind !== "curve") {
        return { kind: "ignore" };
      }
      if (first === null) {
        return { kind: "await-second", first: pick };
      }
      if (
        first.ref.entityId === pick.ref.entityId ||
        (first.kind !== "line" && first.kind !== "curve")
      ) {
        return { kind: "ignore" };
      }
      // Two lines cannot be tangent; need at least one circle/arc.
      if (first.kind === "line" && pick.kind === "line") {
        return { kind: "ignore" };
      }
      return {
        kind: "create",
        request: { type: "tangent", references: [first.ref, pick.ref] },
      };
    }
    case "concentric": {
      if (pick.kind !== "curve") {
        return { kind: "ignore" };
      }
      if (first === null) {
        return { kind: "await-second", first: pick };
      }
      if (first.kind !== "curve" || first.ref.entityId === pick.ref.entityId) {
        return { kind: "ignore" };
      }
      return {
        kind: "create",
        request: { type: "concentric", references: [first.ref, pick.ref] },
      };
    }
    case "midpoint": {
      if (pick.kind !== "point-like" && pick.kind !== "line") {
        return { kind: "ignore" };
      }
      if (first === null) {
        return { kind: "await-second", first: pick };
      }
      if (
        (first.kind !== "point-like" && first.kind !== "line") ||
        first.kind === pick.kind
      ) {
        return { kind: "ignore" };
      }
      return {
        kind: "create",
        request: { type: "midpoint", references: [first.ref, pick.ref] },
      };
    }
    case "equal": {
      if (pick.kind !== "line" && pick.kind !== "curve") {
        return { kind: "ignore" };
      }
      if (first === null) {
        return { kind: "await-second", first: pick };
      }
      if (
        first.ref.entityId === pick.ref.entityId ||
        (first.kind !== "line" && first.kind !== "curve") ||
        first.kind !== pick.kind
      ) {
        return { kind: "ignore" };
      }
      return {
        kind: "create",
        request: { type: "equal", references: [first.ref, pick.ref] },
      };
    }
    case "point-on-object": {
      if (pick.kind !== "point-like" && pick.kind !== "on-object") {
        return { kind: "ignore" };
      }
      if (first === null) {
        return { kind: "await-second", first: pick };
      }
      if (
        (first.kind !== "point-like" && first.kind !== "on-object") ||
        first.kind === pick.kind
      ) {
        return { kind: "ignore" };
      }
      return {
        kind: "create",
        request: { type: "point-on-object", references: [first.ref, pick.ref] },
      };
    }
    case "symmetric": {
      if (pick.kind !== "point-like" && pick.kind !== "line") {
        return { kind: "ignore" };
      }
      if (first === null) {
        return { kind: "await-second", first: pick };
      }
      if (second === null) {
        if (samePick(first, pick)) {
          return { kind: "ignore" };
        }
        // Reject two lines early (need exactly one mirror).
        if (first.kind === "line" && pick.kind === "line") {
          return { kind: "ignore" };
        }
        return { kind: "await-third", first, second: pick };
      }
      if (samePick(first, pick) || samePick(second, pick)) {
        return { kind: "ignore" };
      }
      const refs = [first.ref, second.ref, pick.ref];
      const pointCount = [first, second, pick].filter(
        (item) => item.kind === "point-like",
      ).length;
      const lineCount = [first, second, pick].filter(
        (item) => item.kind === "line",
      ).length;
      if (pointCount !== 2 || lineCount !== 1) {
        return { kind: "ignore" };
      }
      return {
        kind: "create",
        request: { type: "symmetric", references: refs },
      };
    }
    case "horizontal":
    case "vertical": {
      const type = tool;
      if (first === null) {
        if (pick.kind === "line") {
          return { kind: "create", request: { type, references: [pick.ref] } };
        }
        return pick.kind === "point-like"
          ? { kind: "await-second", first: pick }
          : { kind: "ignore" };
      }
      if (pick.kind !== "point-like") {
        return { kind: "ignore" };
      }
      return { kind: "create", request: { type, references: [first.ref, pick.ref] } };
    }
    case "dim-distance": {
      const asDistancePick = (item: ConstraintToolPick): DistancePick | null => {
        if (item.kind === "point-like") {
          return { kind: "point-like", ref: item.ref };
        }
        if (item.kind === "line") {
          return { kind: "line", ref: item.ref };
        }
        return null;
      };
      if (first === null) {
        return pick.kind === "point-like" || pick.kind === "line"
          ? { kind: "await-second", first: pick }
          : { kind: "ignore" };
      }
      const a = asDistancePick(first);
      const b = asDistancePick(pick);
      if (a === null || b === null || sketch === null) {
        return { kind: "ignore" };
      }
      const request = classifyDistancePicks(sketch, a, b);
      if (request === null) {
        return { kind: "ignore" };
      }
      return { kind: "create", request };
    }
    case "dim-radial": {
      if (pick.kind !== "curve" || sketch === null) {
        return { kind: "ignore" };
      }
      const request = classifyRadialPick(
        sketch,
        pick.ref.entityId,
        preferRadius,
      );
      return request === null
        ? { kind: "ignore" }
        : { kind: "create", request };
    }
    case "dim-angle":
      if (pick.kind !== "line") {
        return { kind: "ignore" };
      }
      if (first === null) {
        return { kind: "await-second", first: pick };
      }
      if (first.ref.entityId === pick.ref.entityId) {
        return { kind: "ignore" };
      }
      return { kind: "create", request: { type: "angle", references: [first.ref, pick.ref] } };
  }
}

function samePick(a: ConstraintToolPick, b: ConstraintToolPick): boolean {
  return (
    a.kind === b.kind &&
    a.ref.entityId === b.ref.entityId &&
    a.ref.role === b.ref.role
  );
}

/** Map a hit to a pick: circle/arc rim or center → curve (for radius tools). */
export function constraintToolPickFromHit(
  sketch: Sketch,
  hit: HitResult,
  tool: ConstraintPickToolId,
): ConstraintToolPick | null {
  const entity = sketch.geometry.find((item) => item.id === hit.entityId);
  if (entity === undefined) {
    // World-frame datums (axes / origin) are not in geometry[].
    const datumPick = constraintPickFromHit(sketch, hit);
    if (datumPick === null) {
      return null;
    }
    return datumPick.kind === "line-object"
      ? { kind: "line", ref: datumPick.ref }
      : datumPick;
  }
  const wantsCurve =
    tool === "dim-radial" ||
    tool === "fix" ||
    tool === "tangent" ||
    tool === "concentric" ||
    tool === "equal";
  if ((entity.type === "circle" || entity.type === "arc") && (wantsCurve || hit.part === "edge")) {
    return { kind: "curve", ref: { entityId: entity.id, role: "entity" } };
  }
  if (tool === "point-on-object") {
    if (entity.type === "line" && hit.part === "edge") {
      return { kind: "on-object", ref: { entityId: entity.id, role: "entity" } };
    }
    if (
      (entity.type === "circle" || entity.type === "arc") &&
      hit.part === "edge"
    ) {
      return { kind: "on-object", ref: { entityId: entity.id, role: "entity" } };
    }
    const pick = constraintPickFromHit(sketch, hit);
    if (pick?.kind === "point-like") {
      return pick;
    }
    return null;
  }
  const pick = constraintPickFromHit(sketch, hit);
  if (pick === null) {
    return null;
  }
  return pick.kind === "line-object" ? { kind: "line", ref: pick.ref } : pick;
}

export function handleConstraintPickToolPointerDown(
  tool: ConstraintPickToolId,
  context: ToolPointerContext,
  state: ConstraintPickToolState,
): { readonly state: ConstraintPickToolState; readonly result: ToolPointerResult } {
  const idle = (keep: ConstraintPickToolState) => ({
    state: keep,
    result: {
      activeSnap: null,
      cursorWorld: context.worldPoint,
      creationSessionActive: keep.first !== null,
    },
  });

  const hit = hitTestSketch(context.sketch, context.worldPoint, {
    camera: context.camera,
  });
  const rawPick = hit === null ? null : constraintToolPickFromHit(context.sketch, hit, tool);
  if (rawPick === null) {
    return idle(state);
  }

  const pick = rawPick;
  if (pick === null) {
    return idle(state);
  }

  const step = interpretConstraintPick(
    tool,
    state.first,
    pick,
    state.second,
    context.sketch,
    context.modifiers.shift,
  );
  if (step.kind === "ignore") {
    return idle(state);
  }

  const selection = selectEntityInSketch(
    context.selection,
    context.sketch.constraints,
    pick.ref.entityId,
  );
  if (step.kind === "await-second") {
    return {
      state: { first: step.first, second: null },
      result: {
        selection,
        activeSnap: null,
        cursorWorld: context.worldPoint,
        creationSessionActive: true,
      },
    };
  }
  if (step.kind === "await-third") {
    return {
      state: { first: step.first, second: step.second },
      result: {
        selection,
        activeSnap: null,
        cursorWorld: context.worldPoint,
        creationSessionActive: true,
      },
    };
  }
  return {
    state: createConstraintPickToolState(),
    result: {
      createConstraint: step.request,
      selection,
      activeSnap: null,
      cursorWorld: context.worldPoint,
      creationSessionActive: false,
    },
  };
}

export function handleConstraintPickToolPointerMove(
  context: ToolPointerContext,
  state: ConstraintPickToolState,
): ToolPointerResult {
  return {
    activeSnap: null,
    cursorWorld: context.worldPoint,
    creationSessionActive: state.first !== null,
  };
}

export function cancelConstraintPickToolSession(
  state: ConstraintPickToolState,
): { readonly state: ConstraintPickToolState; readonly cancelled: boolean } {
  if (state.first === null) {
    return { state, cancelled: false };
  }
  return { state: createConstraintPickToolState(), cancelled: true };
}

