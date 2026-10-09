import type { ConstraintType } from "../model/Constraint.ts";
import {
  isDimensionalConstraintType,
  isFeatureConstraintType,
  isGeometricConstraintType,
} from "../model/Constraint.ts";

export type ConstraintCategory = "geometric" | "dimensional" | "feature";

export interface ConstraintTypeInfo {
  readonly type: ConstraintType;
  readonly category: ConstraintCategory;
  readonly label: string;
  readonly minReferences: number;
  readonly maxReferences: number;
  /** Dimensional types require a finite `value`. */
  readonly requiresValue: boolean;
}

const GEOMETRIC: readonly ConstraintTypeInfo[] = [
  entry("coincident", "geometric", "Coincident", 2, 2, false),
  entry("horizontal", "geometric", "Horizontal", 1, 2, false),
  entry("vertical", "geometric", "Vertical", 1, 2, false),
  entry("parallel", "geometric", "Parallel", 2, 2, false),
  entry("perpendicular", "geometric", "Perpendicular", 2, 2, false),
  entry("tangent", "geometric", "Tangent", 2, 2, false),
  entry("concentric", "geometric", "Concentric", 2, 2, false),
  entry("equal", "geometric", "Equal", 2, 2, false),
  entry("midpoint", "geometric", "Midpoint", 2, 2, false),
  entry("point-on-object", "geometric", "Point on object", 2, 2, false),
  entry("symmetric", "geometric", "Symmetric", 3, 3, false),
  entry("fix", "geometric", "Fix", 1, 1, false),
];

const FEATURE: readonly ConstraintTypeInfo[] = [
  entry("rectangle", "feature", "Rectangle", 4, 8, false),
  entry("fillet", "feature", "Fillet", 3, 3, true),
  entry("chamfer", "feature", "Chamfer", 3, 3, true),
];

const DIMENSIONAL: readonly ConstraintTypeInfo[] = [
  entry("length", "dimensional", "Length", 1, 1, true),
  entry("distance", "dimensional", "Distance", 2, 2, true),
  entry("horizontal-distance", "dimensional", "Horizontal distance", 2, 2, true),
  entry("vertical-distance", "dimensional", "Vertical distance", 2, 2, true),
  entry("radius", "dimensional", "Radius", 1, 1, true),
  entry("diameter", "dimensional", "Diameter", 1, 1, true),
  entry("angle", "dimensional", "Angle", 2, 3, true),
  entry("coordinate-x", "dimensional", "Offset from Y-axis", 1, 1, true),
  entry("coordinate-y", "dimensional", "Offset from X-axis", 1, 1, true),
];

export const CONSTRAINT_TYPE_CATALOG: readonly ConstraintTypeInfo[] = [
  ...GEOMETRIC,
  ...FEATURE,
  ...DIMENSIONAL,
];

const BY_TYPE = new Map(
  CONSTRAINT_TYPE_CATALOG.map((info) => [info.type, info]),
);

export function getConstraintTypeInfo(
  type: ConstraintType,
): ConstraintTypeInfo | undefined {
  return BY_TYPE.get(type);
}

export function listConstraintTypes(
  category?: ConstraintCategory,
): readonly ConstraintTypeInfo[] {
  if (category === undefined) {
    return CONSTRAINT_TYPE_CATALOG;
  }
  return CONSTRAINT_TYPE_CATALOG.filter((info) => info.category === category);
}

export function constraintCategory(
  type: ConstraintType,
): ConstraintCategory | null {
  if (isGeometricConstraintType(type)) {
    return "geometric";
  }
  if (isFeatureConstraintType(type)) {
    return "feature";
  }
  if (isDimensionalConstraintType(type)) {
    return "dimensional";
  }
  return null;
}

function entry(
  type: ConstraintType,
  category: ConstraintCategory,
  label: string,
  minReferences: number,
  maxReferences: number,
  requiresValue: boolean,
): ConstraintTypeInfo {
  return {
    type,
    category,
    label,
    minReferences,
    maxReferences,
    requiresValue,
  };
}
