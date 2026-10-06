import type { Constraint, ConstraintId } from "../model/Constraint.ts";
import type { EntityId } from "../model/Geometry.ts";

/**
 * Entity → constraint incidence index.
 * Pure structural graph; does not encode solver residuals or DOF.
 */
export interface ConstraintGraph {
  readonly constraintIdsByEntity: ReadonlyMap<EntityId, readonly ConstraintId[]>;
  readonly entityIdsByConstraint: ReadonlyMap<ConstraintId, readonly EntityId[]>;
}

export function buildConstraintGraph(
  constraints: readonly Constraint[],
): ConstraintGraph {
  const constraintIdsByEntity = new Map<EntityId, ConstraintId[]>();
  const entityIdsByConstraint = new Map<ConstraintId, EntityId[]>();

  for (const constraint of constraints) {
    const entityIds: EntityId[] = [];
    const seen = new Set<EntityId>();

    for (const reference of constraint.references) {
      if (!seen.has(reference.entityId)) {
        seen.add(reference.entityId);
        entityIds.push(reference.entityId);
      }

      const list = constraintIdsByEntity.get(reference.entityId);
      if (list === undefined) {
        constraintIdsByEntity.set(reference.entityId, [constraint.id]);
      } else if (!list.includes(constraint.id)) {
        list.push(constraint.id);
      }
    }

    entityIdsByConstraint.set(constraint.id, entityIds);
  }

  return { constraintIdsByEntity, entityIdsByConstraint };
}

export function constraintsForEntity(
  graph: ConstraintGraph,
  entityId: EntityId,
): readonly ConstraintId[] {
  return graph.constraintIdsByEntity.get(entityId) ?? [];
}

export function entitiesForConstraint(
  graph: ConstraintGraph,
  constraintId: ConstraintId,
): readonly EntityId[] {
  return graph.entityIdsByConstraint.get(constraintId) ?? [];
}
