import type { Constraint, ConstraintId } from "./Constraint.ts";
import type { EntityId } from "./Geometry.ts";

export interface FilletFeatureIds {
  readonly constraintId: ConstraintId;
  readonly line1Id: EntityId;
  readonly line2Id: EntityId;
  readonly arcId: EntityId;
  readonly radiusMm: number;
}

export interface ChamferFeatureIds {
  readonly constraintId: ConstraintId;
  readonly line1Id: EntityId;
  readonly line2Id: EntityId;
  readonly chamferLineId: EntityId;
  /** Driving face length of the chamfer segment (mm). */
  readonly lengthMm: number;
}

export function isFilletConstraint(
  constraint: Constraint,
): constraint is Constraint & { readonly type: "fillet" } {
  return constraint.type === "fillet" && constraint.references.length >= 3;
}

export function isChamferConstraint(
  constraint: Constraint,
): constraint is Constraint & { readonly type: "chamfer" } {
  return constraint.type === "chamfer" && constraint.references.length >= 3;
}

export function parseFilletFeature(
  constraint: Constraint,
): FilletFeatureIds | null {
  if (!isFilletConstraint(constraint) || constraint.value === undefined) {
    return null;
  }
  const byRole = new Map(
    constraint.references.map((reference) => [reference.role, reference.entityId]),
  );
  const line1Id = byRole.get("first");
  const line2Id = byRole.get("second");
  const arcId = byRole.get("entity");
  if (line1Id === undefined || line2Id === undefined || arcId === undefined) {
    return null;
  }
  return {
    constraintId: constraint.id,
    line1Id,
    line2Id,
    arcId,
    radiusMm: constraint.value,
  };
}

export function parseChamferFeature(
  constraint: Constraint,
): ChamferFeatureIds | null {
  if (!isChamferConstraint(constraint) || constraint.value === undefined) {
    return null;
  }
  const byRole = new Map(
    constraint.references.map((reference) => [reference.role, reference.entityId]),
  );
  const line1Id = byRole.get("first");
  const line2Id = byRole.get("second");
  const chamferLineId = byRole.get("entity");
  if (
    line1Id === undefined ||
    line2Id === undefined ||
    chamferLineId === undefined
  ) {
    return null;
  }
  return {
    constraintId: constraint.id,
    line1Id,
    line2Id,
    chamferLineId,
    lengthMm: constraint.value,
  };
}

export function findFilletFeatureForEntity(
  constraints: readonly Constraint[],
  entityId: EntityId,
): FilletFeatureIds | null {
  return listFilletFeaturesForEntity(constraints, entityId)[0] ?? null;
}

/** A line may belong to fillets at both ends. */
export function listFilletFeaturesForEntity(
  constraints: readonly Constraint[],
  entityId: EntityId,
): FilletFeatureIds[] {
  const features: FilletFeatureIds[] = [];
  for (const constraint of constraints) {
    const feature = parseFilletFeature(constraint);
    if (feature === null) {
      continue;
    }
    if (
      feature.line1Id === entityId ||
      feature.line2Id === entityId ||
      feature.arcId === entityId
    ) {
      features.push(feature);
    }
  }
  return features;
}

export function findChamferFeatureForEntity(
  constraints: readonly Constraint[],
  entityId: EntityId,
): ChamferFeatureIds | null {
  return listChamferFeaturesForEntity(constraints, entityId)[0] ?? null;
}

export function listChamferFeaturesForEntity(
  constraints: readonly Constraint[],
  entityId: EntityId,
): ChamferFeatureIds[] {
  const features: ChamferFeatureIds[] = [];
  for (const constraint of constraints) {
    const feature = parseChamferFeature(constraint);
    if (feature === null) {
      continue;
    }
    if (
      feature.line1Id === entityId ||
      feature.line2Id === entityId ||
      feature.chamferLineId === entityId
    ) {
      features.push(feature);
    }
  }
  return features;
}

export function filletEntityIds(feature: FilletFeatureIds): EntityId[] {
  return [feature.line1Id, feature.line2Id, feature.arcId];
}

export function chamferEntityIds(feature: ChamferFeatureIds): EntityId[] {
  return [feature.line1Id, feature.line2Id, feature.chamferLineId];
}
