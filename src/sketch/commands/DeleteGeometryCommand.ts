import type { Constraint } from "../model/Constraint.ts";
import type { EntityId } from "../model/Geometry.ts";
import {
  findRectangleFeatureForEntity,
  rectangleEntityIds,
} from "../model/RectangleFeature.ts";
import { isDatumId } from "../model/SketchFrame.ts";
import type { Sketch } from "../model/Sketch.ts";
import type { SketchCommand } from "./Command.ts";

export const WORLD_FRAME_DELETE_BLOCKED_REASON =
  "World axes cannot be deleted.";

export function expandDeletionIds(
  sketch: Sketch,
  entityIds: readonly EntityId[],
): EntityId[] {
  const expanded = new Set<EntityId>();

  for (const entityId of entityIds) {
    if (isDatumId(sketch.frame, entityId)) {
      continue;
    }
    const feature = findRectangleFeatureForEntity(sketch.constraints, entityId);
    if (feature !== null) {
      for (const id of rectangleEntityIds(feature)) {
        expanded.add(id);
      }
      continue;
    }
    expanded.add(entityId);
  }

  return [...expanded];
}

export function removeGeometry(
  sketch: Sketch,
  entityIds: readonly EntityId[],
): Sketch {
  if (entityIds.length === 0) {
    return sketch;
  }

  const removeSet = new Set(expandDeletionIds(sketch, entityIds));
  const geometry = sketch.geometry.filter((entity) => !removeSet.has(entity.id));
  const constraints = sketch.constraints.filter(
    (constraint) => !constraintReferencesRemoved(constraint, removeSet),
  );

  if (
    geometry.length === sketch.geometry.length &&
    constraints.length === sketch.constraints.length
  ) {
    return sketch;
  }

  return {
    ...sketch,
    geometry,
    constraints,
  };
}

export function createDeleteGeometryCommand(
  sketch: Sketch,
  entityIds: readonly EntityId[],
): SketchCommand | null {
  if (entityIds.length === 0) {
    return null;
  }

  const removeSet = new Set(expandDeletionIds(sketch, entityIds));
  const previousGeometry = sketch.geometry;
  const previousConstraints = sketch.constraints;
  const removedCount = previousGeometry.filter((entity) =>
    removeSet.has(entity.id),
  ).length;

  if (removedCount === 0) {
    return null;
  }

  return {
    label: `Delete ${removedCount} entit${removedCount === 1 ? "y" : "ies"}`,
    apply(current) {
      return removeGeometry(current, entityIds);
    },
    undo(current) {
      return {
        ...current,
        geometry: previousGeometry,
        constraints: previousConstraints,
      };
    },
  };
}

/** True when every selected id is a world-frame datum (delete should be blocked). */
export function selectionIsOnlyDatums(
  sketch: Sketch,
  entityIds: readonly EntityId[],
): boolean {
  return (
    entityIds.length > 0 &&
    entityIds.every((id) => isDatumId(sketch.frame, id))
  );
}

function constraintReferencesRemoved(
  constraint: Constraint,
  removeSet: ReadonlySet<EntityId>,
): boolean {
  return constraint.references.some((reference) =>
    removeSet.has(reference.entityId),
  );
}
