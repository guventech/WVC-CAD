import { expandDeletionIds } from "../commands/DeleteGeometryCommand.ts";
import type { EntityId, Geometry, LineGeometry } from "../model/Geometry.ts";
import {
  findFrameAxis,
  isDatumId,
  resolveFrameAxisLine,
  resolveFrameOrigin,
} from "../model/SketchFrame.ts";
import type { Sketch } from "../model/Sketch.ts";
import type { Point2D } from "./Point2D.ts";
import { mirrorConstraintsAcrossMap } from "./MirrorConstraintCopy.ts";
import {
  isValidMirrorAxis,
  mirrorGeometryAcrossLine,
} from "./MirrorMath.ts";

export type MirrorFailureReason =
  | "Nothing selected"
  | "Invalid mirror axis"
  | "No geometry to mirror"
  | "Cannot mirror world datums";

export type MirrorOutcome =
  | { readonly ok: true; readonly sketch: Sketch; readonly mirroredIds: readonly EntityId[] }
  | { readonly ok: false; readonly reason: MirrorFailureReason };

export type MirrorAxis =
  | { readonly kind: "line"; readonly entityId: EntityId }
  | { readonly kind: "frame-axis"; readonly entityId: EntityId };

/**
 * Resolve a user-picked mirror axis to two world points defining an infinite line.
 * Accepts sketch lines (construction or solid) and world-frame X/Y axes.
 */
export function resolveMirrorAxis(
  sketch: Sketch,
  axis: MirrorAxis,
): { readonly a0: Point2D; readonly a1: Point2D } | null {
  if (axis.kind === "frame-axis") {
    if (findFrameAxis(sketch.frame, axis.entityId) === null) {
      return null;
    }
    const line = resolveFrameAxisLine(sketch.frame, axis.entityId);
    if (line === null) {
      return null;
    }
    return { a0: line.start, a1: line.end };
  }

  const entity = sketch.geometry.find((item) => item.id === axis.entityId);
  if (entity === undefined || entity.type !== "line") {
    return null;
  }
  return { a0: entity.start, a1: entity.end };
}

/**
 * Duplicate selected geometry mirrored across the axis.
 * Also copies geometric/dimensional constraints whose refs all lie in the
 * mirrored set (feature constraints are skipped).
 * Rectangle feature members expand to the whole feature.
 */
export function applyMirror(
  sketch: Sketch,
  selectedIds: readonly EntityId[],
  axis: MirrorAxis,
): MirrorOutcome {
  if (selectedIds.length === 0) {
    return { ok: false, reason: "Nothing selected" };
  }

  if (selectedIds.every((id) => isDatumId(sketch.frame, id))) {
    return { ok: false, reason: "Cannot mirror world datums" };
  }

  const resolved = resolveMirrorAxis(sketch, axis);
  if (resolved === null || !isValidMirrorAxis(resolved.a0, resolved.a1)) {
    return { ok: false, reason: "Invalid mirror axis" };
  }

  // Do not mirror the axis line itself when it is part of the selection.
  const excludeAxis =
    axis.kind === "line" ? new Set<EntityId>([axis.entityId]) : new Set<EntityId>();

  const sourceIds = expandDeletionIds(sketch, selectedIds).filter(
    (id) => !excludeAxis.has(id) && !isDatumId(sketch.frame, id),
  );

  const sources: Geometry[] = [];
  for (const id of sourceIds) {
    const entity = sketch.geometry.find((item) => item.id === id);
    if (entity !== undefined) {
      sources.push(entity);
    }
  }

  if (sources.length === 0) {
    return { ok: false, reason: "No geometry to mirror" };
  }

  const mirrored = sources.map((entity) =>
    mirrorGeometryAcrossLine(entity, resolved.a0, resolved.a1),
  );
  const idMap = new Map<EntityId, EntityId>();
  for (let i = 0; i < sources.length; i += 1) {
    idMap.set(sources[i]!.id, mirrored[i]!.id);
  }
  const copiedConstraints = mirrorConstraintsAcrossMap(
    sketch,
    new Set(sourceIds),
    idMap,
  );

  return {
    ok: true,
    sketch: {
      ...sketch,
      geometry: [...sketch.geometry, ...mirrored],
      constraints: [...sketch.constraints, ...copiedConstraints],
    },
    mirroredIds: mirrored.map((entity) => entity.id),
  };
}

/** Convenience: mirror about the world X axis (horizontal reflection). */
export function mirrorAboutWorldXAxis(
  sketch: Sketch,
  selectedIds: readonly EntityId[],
): MirrorOutcome {
  const axis = sketch.frame.axes.find((item) => item.tag === "x");
  if (axis === undefined) {
    return { ok: false, reason: "Invalid mirror axis" };
  }
  return applyMirror(sketch, selectedIds, {
    kind: "frame-axis",
    entityId: axis.id,
  });
}

/** Convenience: mirror about the world Y axis (vertical reflection). */
export function mirrorAboutWorldYAxis(
  sketch: Sketch,
  selectedIds: readonly EntityId[],
): MirrorOutcome {
  const axis = sketch.frame.axes.find((item) => item.tag === "y");
  if (axis === undefined) {
    return { ok: false, reason: "Invalid mirror axis" };
  }
  return applyMirror(sketch, selectedIds, {
    kind: "frame-axis",
    entityId: axis.id,
  });
}

export function isMirrorableLine(entity: Geometry): entity is LineGeometry {
  return entity.type === "line";
}

/** Origin helper for tests / axis validation. */
export function worldOriginOf(sketch: Sketch): Point2D {
  return resolveFrameOrigin(sketch.frame);
}
