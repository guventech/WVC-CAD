import { distance, TOLERANCE } from "../geometry/GeometryMath.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import type {
  Constraint,
  ConstraintReference,
  ConstraintType,
} from "../model/Constraint.ts";
import { isDrivingConstraint } from "../model/Constraint.ts";
import type { EntityId, LineGeometry } from "../model/Geometry.ts";
import type { Sketch } from "../model/Sketch.ts";
import {
  findEntity,
  isLineObjectReference,
  isPointLikeReference,
  normalizePointLikeRef,
  resolveConstraintPoint,
  sameConstraintRef,
} from "./ConstraintRef.ts";

/** Dimensional types enforced by the solver (Chunk 13 + coordinate anchors). */
export type SupportedDimensionType =
  | "length"
  | "distance"
  | "horizontal-distance"
  | "vertical-distance"
  | "radius"
  | "diameter"
  | "angle"
  | "coordinate-x"
  | "coordinate-y";

export function isSupportedDimensionType(
  type: ConstraintType,
): type is SupportedDimensionType {
  switch (type) {
    case "length":
    case "distance":
    case "horizontal-distance":
    case "vertical-distance":
    case "radius":
    case "diameter":
    case "angle":
    case "coordinate-x":
    case "coordinate-y":
      return true;
    default:
      return false;
  }
}

/** Two point handles for horizontal/vertical distance (normalized), or null. */
export function distanceHandles(
  sketch: Sketch,
  references: readonly ConstraintReference[],
): readonly [ConstraintReference, ConstraintReference] | null {
  const [rawA, rawB] = references;
  if (
    references.length !== 2 ||
    rawA === undefined ||
    rawB === undefined ||
    !isPointLikeReference(sketch, rawA) ||
    !isPointLikeReference(sketch, rawB)
  ) {
    return null;
  }
  const a = normalizePointLikeRef(sketch, rawA);
  const b = normalizePointLikeRef(sketch, rawB);
  return sameConstraintRef(a, b) ? null : [a, b];
}

export function referencedLine(
  sketch: Sketch,
  ref: ConstraintReference | undefined,
): LineGeometry | null {
  if (ref === undefined || !isLineObjectReference(sketch, ref)) {
    return null;
  }
  const entity = findEntity(sketch, ref.entityId);
  return entity?.type === "line" ? entity : null;
}

/** Unsigned angle between line directions (start→end), radians in [0, π]. */
export function angleBetweenLines(a: LineGeometry, b: LineGeometry): number {
  return Math.abs(signedAngleBetweenLines(a, b));
}

/** Signed angle from line `a` direction to line `b` direction, (-π, π]. */
export function signedAngleBetweenLines(a: LineGeometry, b: LineGeometry): number {
  const ax = a.end.x - a.start.x;
  const ay = a.end.y - a.start.y;
  const bx = b.end.x - b.start.x;
  const by = b.end.y - b.start.y;
  return Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
}

/**
 * Current geometric value of a dimension (mm, or radians for angle).
 * Null when references do not form a supported pattern.
 */
export function measureDimension(
  sketch: Sketch,
  type: ConstraintType,
  references: readonly ConstraintReference[],
): number | null {
  switch (type) {
    case "length": {
      const line = references.length === 1 ? referencedLine(sketch, references[0]) : null;
      return line === null ? null : distance(line.start, line.end);
    }
    case "distance": {
      const handles = distanceHandles(sketch, references);
      const points = handles === null ? null : resolvePair(sketch, handles);
      if (points === null) {
        return null;
      }
      return distance(points[0], points[1]);
    }
    case "horizontal-distance":
    case "vertical-distance": {
      const handles = distanceHandles(sketch, references);
      const points = handles === null ? null : resolvePair(sketch, handles);
      if (points === null) {
        return null;
      }
      return type === "horizontal-distance"
        ? Math.abs(points[1].x - points[0].x)
        : Math.abs(points[1].y - points[0].y);
    }
    case "radius":
    case "diameter": {
      const ref = references.length === 1 ? references[0] : undefined;
      const entity = ref === undefined ? undefined : findEntity(sketch, ref.entityId);
      if (entity?.type !== "circle" && entity?.type !== "arc") {
        return null;
      }
      return type === "radius" ? entity.radius : entity.radius * 2;
    }
    case "angle": {
      if (references.length !== 2) {
        return null;
      }
      const a = referencedLine(sketch, references[0]);
      const b = referencedLine(sketch, references[1]);
      if (a === null || b === null || a.id === b.id) {
        return null;
      }
      return angleBetweenLines(a, b);
    }
    case "coordinate-x":
    case "coordinate-y": {
      const point = resolveCoordinatePoint(sketch, references[0]);
      if (point === null) {
        return null;
      }
      return type === "coordinate-x" ? point.x : point.y;
    }
    default:
      return null;
  }
}

/** |measured − value| for a supported driving dimension; null otherwise. */
export function dimensionResidual(
  sketch: Sketch,
  constraint: Constraint,
): number | null {
  if (
    !isSupportedDimensionType(constraint.type) ||
    !isDrivingConstraint(constraint) ||
    constraint.value === undefined
  ) {
    return null;
  }
  const measured = measureDimension(sketch, constraint.type, constraint.references);
  return measured === null ? null : Math.abs(measured - constraint.value);
}

export function dimensionTolerance(type: ConstraintType): number {
  return type === "angle" ? TOLERANCE.angular : TOLERANCE.coincidence;
}

/**
 * Validate a dimension value in model units (mm or radians).
 * Returns an error message, or null when acceptable.
 */
export function validateDimensionValue(
  type: SupportedDimensionType,
  value: number,
): string | null {
  if (!Number.isFinite(value)) {
    return "Value must be a finite number.";
  }
  switch (type) {
    case "length":
    case "distance":
      return value > TOLERANCE.coincidence
        ? null
        : type === "length"
          ? "Length must be greater than 0 mm."
          : "Distance must be greater than 0 mm.";
    case "radius":
      return value > TOLERANCE.coincidence ? null : "Radius must be greater than 0 mm.";
    case "diameter":
      return value > TOLERANCE.coincidence ? null : "Diameter must be greater than 0 mm.";
    case "horizontal-distance":
    case "vertical-distance":
      return value >= 0 ? null : "Distance cannot be negative.";
    case "angle":
      return value > TOLERANCE.angular && value < Math.PI - TOLERANCE.angular
        ? null
        : "Angle must be between 0° and 180° (exclusive).";
    case "coordinate-x":
    case "coordinate-y":
      return null;
  }
}

/**
 * True when a driving radius or diameter dimension references this entity.
 * Used to hard-lock rim/radius drag; size changes go through dimension edit.
 */
export function entityHasDrivingRadiusDimension(
  sketch: Sketch,
  entityId: EntityId,
): boolean {
  return sketch.constraints.some(
    (constraint) =>
      (constraint.type === "radius" || constraint.type === "diameter") &&
      isDrivingConstraint(constraint) &&
      constraint.references.some((ref) => ref.entityId === entityId),
  );
}

/** Point or circle/arc center used by coordinate-x / coordinate-y. */
export function resolveCoordinatePoint(
  sketch: Sketch,
  ref: ConstraintReference | undefined,
): Point2D | null {
  if (ref === undefined) {
    return null;
  }
  const entity = findEntity(sketch, ref.entityId);
  if (entity === undefined) {
    return null;
  }
  if (entity.type === "point") {
    return { x: entity.position.x, y: entity.position.y };
  }
  if (entity.type === "circle" || entity.type === "arc") {
    if (ref.role === "center" || ref.role === "entity") {
      return { x: entity.center.x, y: entity.center.y };
    }
  }
  if (entity.type === "line" && (ref.role === "start" || ref.role === "end")) {
    return resolveConstraintPoint(sketch, ref);
  }
  return null;
}

function resolvePair(
  sketch: Sketch,
  handles: readonly [ConstraintReference, ConstraintReference],
): readonly [Point2D, Point2D] | null {
  const a = resolveConstraintPoint(sketch, handles[0]);
  const b = resolveConstraintPoint(sketch, handles[1]);
  return a === null || b === null ? null : [a, b];
}
