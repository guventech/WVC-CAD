import type { EntityId, Geometry } from "../model/Geometry.ts";
import {
  findRectangleFeatureForEntity,
  rectangleEntityIds,
} from "../model/RectangleFeature.ts";
import { isDatumId } from "../model/SketchFrame.ts";
import type { Sketch } from "../model/Sketch.ts";
import type { SketchCommand } from "./Command.ts";

/** Expand selection so rectangle features toggle as one coherent set. */
export function expandConstructionToggleIds(
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

export function setConstructionInSketch(
  sketch: Sketch,
  entityIds: readonly EntityId[],
  construction: boolean,
): Sketch {
  const idSet = new Set(expandConstructionToggleIds(sketch, entityIds));
  if (idSet.size === 0) {
    return sketch;
  }

  let changed = false;
  const geometry = sketch.geometry.map((entity) => {
    if (!idSet.has(entity.id) || entity.construction === construction) {
      return entity;
    }
    changed = true;
    return { ...entity, construction } as Geometry;
  });

  if (!changed) {
    return sketch;
  }

  return {
    ...sketch,
    geometry,
  };
}

/**
 * Toggle construction on selected geometry.
 * If every target is already construction → solid; otherwise → construction.
 */
export function createToggleConstructionCommand(
  sketch: Sketch,
  entityIds: readonly EntityId[],
): SketchCommand | null {
  if (entityIds.length === 0) {
    return null;
  }

  const expanded = expandConstructionToggleIds(sketch, entityIds);
  const targets = sketch.geometry.filter((entity) =>
    expanded.includes(entity.id),
  );
  if (targets.length === 0) {
    return null;
  }

  const targetConstruction = !targets.every((entity) => entity.construction);
  const previous = new Map(
    targets.map((entity) => [entity.id, entity.construction] as const),
  );

  return {
    label: targetConstruction
      ? `Make construction (${targets.length})`
      : `Make solid (${targets.length})`,
    apply(current) {
      return setConstructionInSketch(current, entityIds, targetConstruction);
    },
    undo(current) {
      let changed = false;
      const geometry = current.geometry.map((entity) => {
        const prior = previous.get(entity.id);
        if (prior === undefined || entity.construction === prior) {
          return entity;
        }
        changed = true;
        return { ...entity, construction: prior } as Geometry;
      });
      if (!changed) {
        return current;
      }
      return {
        ...current,
        geometry,
      };
    },
  };
}
