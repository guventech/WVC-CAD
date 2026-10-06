import type {
  Constraint,
  ConstraintId,
  ConstraintReference,
  ConstraintRole,
  DimensionalConstraintType,
} from "../model/Constraint.ts";
import type { EntityId } from "../model/Geometry.ts";
import type { FixLock } from "./Fix.ts";

export function createCoincidentConstraint(
  id: ConstraintId,
  first: { readonly entityId: EntityId; readonly role: ConstraintRole },
  second: { readonly entityId: EntityId; readonly role: ConstraintRole },
): Constraint {
  return {
    id,
    type: "coincident",
    references: [first, second],
  };
}

export function createHorizontalConstraint(
  id: ConstraintId,
  entityId: EntityId,
): Constraint {
  return {
    id,
    type: "horizontal",
    references: [{ entityId, role: "entity" }],
  };
}

export function createVerticalConstraint(
  id: ConstraintId,
  entityId: EntityId,
): Constraint {
  return {
    id,
    type: "vertical",
    references: [{ entityId, role: "entity" }],
  };
}

export function createFixConstraint(
  id: ConstraintId,
  reference: ConstraintReference,
  locked: FixLock,
): Constraint {
  return {
    id,
    type: "fix",
    references: [reference],
    locked: { ...locked },
  };
}

export function createParallelConstraint(
  id: ConstraintId,
  firstLineId: EntityId,
  secondLineId: EntityId,
): Constraint {
  return {
    id,
    type: "parallel",
    references: [
      { entityId: firstLineId, role: "entity" },
      { entityId: secondLineId, role: "entity" },
    ],
  };
}

export function createPerpendicularConstraint(
  id: ConstraintId,
  firstLineId: EntityId,
  secondLineId: EntityId,
): Constraint {
  return {
    id,
    type: "perpendicular",
    references: [
      { entityId: firstLineId, role: "entity" },
      { entityId: secondLineId, role: "entity" },
    ],
  };
}

export function createTangentConstraint(
  id: ConstraintId,
  firstId: EntityId,
  secondId: EntityId,
): Constraint {
  return {
    id,
    type: "tangent",
    references: [
      { entityId: firstId, role: "entity" },
      { entityId: secondId, role: "entity" },
    ],
  };
}

export function createConcentricConstraint(
  id: ConstraintId,
  firstId: EntityId,
  secondId: EntityId,
): Constraint {
  return {
    id,
    type: "concentric",
    references: [
      { entityId: firstId, role: "entity" },
      { entityId: secondId, role: "entity" },
    ],
  };
}

export function createMidpointConstraint(
  id: ConstraintId,
  point: ConstraintReference,
  lineEntityId: EntityId,
): Constraint {
  return {
    id,
    type: "midpoint",
    references: [point, { entityId: lineEntityId, role: "entity" }],
  };
}

export function createEqualConstraint(
  id: ConstraintId,
  firstId: EntityId,
  secondId: EntityId,
): Constraint {
  return {
    id,
    type: "equal",
    references: [
      { entityId: firstId, role: "entity" },
      { entityId: secondId, role: "entity" },
    ],
  };
}

export function createSymmetricConstraint(
  id: ConstraintId,
  first: ConstraintReference,
  second: ConstraintReference,
  axisEntityId: EntityId,
): Constraint {
  return {
    id,
    type: "symmetric",
    references: [
      first,
      second,
      { entityId: axisEntityId, role: "entity" },
    ],
  };
}

export function createPointOnObjectConstraint(
  id: ConstraintId,
  point: ConstraintReference,
  objectEntityId: EntityId,
): Constraint {
  return {
    id,
    type: "point-on-object",
    references: [point, { entityId: objectEntityId, role: "entity" }],
  };
}

export function createRectangleFeatureConstraint(
  id: ConstraintId,
  references: readonly ConstraintReference[],
): Constraint {
  return {
    id,
    type: "rectangle",
    references,
  };
}

export function createFilletFeatureConstraint(
  id: ConstraintId,
  line1Id: EntityId,
  line2Id: EntityId,
  arcId: EntityId,
  radiusMm: number,
): Constraint {
  return {
    id,
    type: "fillet",
    references: [
      { entityId: line1Id, role: "first" },
      { entityId: line2Id, role: "second" },
      { entityId: arcId, role: "entity" },
    ],
    value: radiusMm,
  };
}

export function createChamferFeatureConstraint(
  id: ConstraintId,
  line1Id: EntityId,
  line2Id: EntityId,
  chamferLineId: EntityId,
  lengthMm: number,
): Constraint {
  return {
    id,
    type: "chamfer",
    references: [
      { entityId: line1Id, role: "first" },
      { entityId: line2Id, role: "second" },
      { entityId: chamferLineId, role: "entity" },
    ],
    value: lengthMm,
  };
}

export function createDimensionalConstraint(
  id: ConstraintId,
  type: DimensionalConstraintType,
  references: readonly ConstraintReference[],
  value: number,
  options?: { readonly driving?: boolean },
): Constraint {
  return {
    id,
    type,
    references,
    value,
    driving: options?.driving,
  };
}

export function createLengthConstraint(
  id: ConstraintId,
  lineEntityId: EntityId,
  valueMm: number,
  options?: { readonly driving?: boolean },
): Constraint {
  return createDimensionalConstraint(
    id,
    "length",
    [{ entityId: lineEntityId, role: "entity" }],
    valueMm,
    options,
  );
}

export function createRadiusConstraint(
  id: ConstraintId,
  circleOrArcId: EntityId,
  valueMm: number,
  options?: { readonly driving?: boolean },
): Constraint {
  return createDimensionalConstraint(
    id,
    "radius",
    [{ entityId: circleOrArcId, role: "entity" }],
    valueMm,
    options,
  );
}

export function createAngleConstraint(
  id: ConstraintId,
  firstLineId: EntityId,
  secondLineId: EntityId,
  valueRad: number,
  options?: { readonly driving?: boolean },
): Constraint {
  return createDimensionalConstraint(
    id,
    "angle",
    [
      { entityId: firstLineId, role: "entity" },
      { entityId: secondLineId, role: "entity" },
    ],
    valueRad,
    options,
  );
}

export function createCoordinateConstraint(
  id: ConstraintId,
  type: "coordinate-x" | "coordinate-y",
  entityId: EntityId,
  valueMm: number,
  options?: {
    readonly role?: ConstraintRole;
    readonly driving?: boolean;
  },
): Constraint {
  return createDimensionalConstraint(
    id,
    type,
    [{ entityId, role: options?.role ?? "entity" }],
    valueMm,
    options,
  );
}
