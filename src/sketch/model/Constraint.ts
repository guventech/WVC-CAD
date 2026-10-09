import type { EntityId } from "./Geometry.ts";

export type ConstraintId = string;

/** Geometric constraint kinds (Tier 1–3 catalog; enforcement lands in later chunks). */
export type GeometricConstraintType =
  | "coincident"
  | "horizontal"
  | "vertical"
  | "parallel"
  | "perpendicular"
  | "tangent"
  | "concentric"
  | "equal"
  | "midpoint"
  | "point-on-object"
  | "symmetric"
  | "fix";

/** Feature-level constraint kinds (coherent multi-entity records). */
export type FeatureConstraintType = "rectangle" | "fillet" | "chamfer";

/**
 * Dimensional constraint kinds (value in mm, or radians for angle).
 * `distance` is Euclidean point–point; H/V remain for axis-aligned spans
 * (also created by the unified Distance tool via smart classification).
 */
export type DimensionalConstraintType =
  | "distance"
  | "horizontal-distance"
  | "vertical-distance"
  | "length"
  | "radius"
  | "diameter"
  | "angle"
  | "coordinate-x"
  | "coordinate-y";

export type ConstraintType =
  | GeometricConstraintType
  | FeatureConstraintType
  | DimensionalConstraintType;

/**
 * Role of a referenced entity (or entity endpoint) within a constraint.
 * Rectangle feature roles are stable for ADR-011 parsing.
 */
export type ConstraintRole =
  | "start"
  | "end"
  | "center"
  | "position"
  | "entity"
  | "point"
  | "object"
  | "first"
  | "second"
  | "axis"
  | "corner-bl"
  | "corner-br"
  | "corner-tr"
  | "corner-tl"
  | "edge-bottom"
  | "edge-right"
  | "edge-top"
  | "edge-left";

export interface ConstraintReference {
  readonly entityId: EntityId;
  readonly role: ConstraintRole;
}

/**
 * Parametric constraint record.
 * Geometric/feature constraints omit `value` (except feature radius/length).
 * Dimensional constraints carry `value` (mm, or radians for `angle`) and
 * optional `driving` (default true = drives geometry; false = reference/measure).
 * `fix` stores the locked world position in `locked`.
 */
export interface Constraint {
  readonly id: ConstraintId;
  readonly type: ConstraintType;
  readonly references: readonly ConstraintReference[];
  readonly value?: number;
  readonly driving?: boolean;
  /** World lock for `fix` (point XY; line adds endX/endY; circle/arc adds radius). */
  readonly locked?: {
    readonly x: number;
    readonly y: number;
    readonly endX?: number;
    readonly endY?: number;
    readonly radius?: number;
  };
}

export function isDimensionalConstraintType(
  type: ConstraintType,
): type is DimensionalConstraintType {
  switch (type) {
    case "distance":
    case "horizontal-distance":
    case "vertical-distance":
    case "length":
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

export function isGeometricConstraintType(
  type: ConstraintType,
): type is GeometricConstraintType {
  switch (type) {
    case "coincident":
    case "horizontal":
    case "vertical":
    case "parallel":
    case "perpendicular":
    case "tangent":
    case "concentric":
    case "equal":
    case "midpoint":
    case "point-on-object":
    case "symmetric":
    case "fix":
      return true;
    default:
      return false;
  }
}

export function isFeatureConstraintType(
  type: ConstraintType,
): type is FeatureConstraintType {
  return type === "rectangle" || type === "fillet" || type === "chamfer";
}

/** Whether a dimensional constraint drives geometry (default true when omitted). */
export function isDrivingConstraint(constraint: Constraint): boolean {
  if (!isDimensionalConstraintType(constraint.type)) {
    return true;
  }
  return constraint.driving !== false;
}
