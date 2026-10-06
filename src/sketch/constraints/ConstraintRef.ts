import type { ConstraintReference, ConstraintRole } from "../model/Constraint.ts";
import type { EntityId, Geometry } from "../model/Geometry.ts";
import {
  cornerPointIdForEdgeEndpoint,
  findRectangleFeatureForEntity,
} from "../model/RectangleFeature.ts";
import {
  findFrameAxis,
  isDatumOriginId,
  resolveFrameAxisLine,
  resolveFrameOrigin,
} from "../model/SketchFrame.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import type { Sketch } from "../model/Sketch.ts";

export type PointLikeRole = "position" | "start" | "end" | "center";

export function isPointLikeRole(role: ConstraintRole): role is PointLikeRole {
  return (
    role === "position" ||
    role === "start" ||
    role === "end" ||
    role === "center"
  );
}

export function handleKey(ref: ConstraintReference): string {
  return `${ref.entityId}:${ref.role}`;
}

export function sameConstraintRef(
  a: ConstraintReference,
  b: ConstraintReference,
): boolean {
  return a.entityId === b.entityId && a.role === b.role;
}

/** Read the world position of a point-like constraint reference. */
export function resolveConstraintPoint(
  sketch: Sketch,
  ref: ConstraintReference,
): Point2D | null {
  if (
    isDatumOriginId(sketch.frame, ref.entityId) &&
    (ref.role === "position" ||
      ref.role === "entity" ||
      ref.role === "point" ||
      ref.role === "center")
  ) {
    return resolveFrameOrigin(sketch.frame);
  }

  const entity = findEntity(sketch, ref.entityId);
  if (entity === undefined) {
    return null;
  }

  switch (entity.type) {
    case "point":
      if (ref.role === "position" || ref.role === "entity" || ref.role === "point") {
        return { x: entity.position.x, y: entity.position.y };
      }
      return null;
    case "line":
      if (ref.role === "start") {
        return { x: entity.start.x, y: entity.start.y };
      }
      if (ref.role === "end") {
        return { x: entity.end.x, y: entity.end.y };
      }
      return null;
    case "circle":
    case "arc":
      if (ref.role === "center") {
        return { x: entity.center.x, y: entity.center.y };
      }
      return null;
  }
}

/** True when the reference denotes a point-like handle (not a whole line/object). */
export function isPointLikeReference(
  sketch: Sketch,
  ref: ConstraintReference,
): boolean {
  return resolveConstraintPoint(sketch, ref) !== null;
}

/**
 * True when the reference is a line (or frame axis) used as an object
 * for point-on-line / point-on-axis coincidence.
 */
export function isLineObjectReference(
  sketch: Sketch,
  ref: ConstraintReference,
): boolean {
  if (
    findFrameAxis(sketch.frame, ref.entityId) !== null &&
    (ref.role === "entity" || ref.role === "object" || ref.role === "axis")
  ) {
    return true;
  }
  const entity = findEntity(sketch, ref.entityId);
  return (
    entity?.type === "line" &&
    (ref.role === "entity" || ref.role === "object")
  );
}

/**
 * Infinite line endpoints for a line entity or frame axis (for projection).
 */
export function resolveLineObjectSegment(
  sketch: Sketch,
  ref: ConstraintReference,
): { readonly start: Point2D; readonly end: Point2D } | null {
  if (!isLineObjectReference(sketch, ref)) {
    return null;
  }
  const axisLine = resolveFrameAxisLine(sketch.frame, ref.entityId);
  if (axisLine !== null) {
    return axisLine;
  }
  const entity = findEntity(sketch, ref.entityId);
  if (entity?.type !== "line") {
    return null;
  }
  return { start: entity.start, end: entity.end };
}

/**
 * Prefer rectangle corner point entities over edge endpoint roles so coincident
 * edits go through the rectangle feature path.
 */
export function normalizePointLikeRef(
  sketch: Sketch,
  ref: ConstraintReference,
): ConstraintReference {
  if (isDatumOriginId(sketch.frame, ref.entityId)) {
    return { entityId: ref.entityId, role: "position" };
  }
  if (ref.role !== "start" && ref.role !== "end") {
    if (ref.role === "entity" || ref.role === "point") {
      const entity = findEntity(sketch, ref.entityId);
      if (entity?.type === "point") {
        return { entityId: ref.entityId, role: "position" };
      }
    }
    return ref;
  }

  const feature = findRectangleFeatureForEntity(sketch.constraints, ref.entityId);
  if (feature === null) {
    return ref;
  }
  const cornerId = cornerPointIdForEdgeEndpoint(
    feature,
    ref.entityId,
    ref.role,
  );
  if (cornerId === null) {
    return ref;
  }
  return { entityId: cornerId, role: "position" };
}

export function findEntity(
  sketch: Sketch,
  entityId: EntityId,
): Geometry | undefined {
  return sketch.geometry.find((entity) => entity.id === entityId);
}
