import { rectangleMetrics } from "../geometry/RectangleMath.ts";
import type { Constraint } from "../model/Constraint.ts";
import type { EntityId, Geometry } from "../model/Geometry.ts";
import {
  findRectangleFeatureForEntity,
  readRectangleCorners,
  rectangleEntityIds,
  type RectangleFeatureIds,
} from "../model/RectangleFeature.ts";
import {
  datumDisplayName,
  type SketchFrame,
} from "../model/SketchFrame.ts";
import { arcSweepRadians, distance } from "../geometry/GeometryMath.ts";

export type SelectionSummaryItem =
  | {
      readonly kind: "rectangle";
      readonly constraintId: string;
      readonly widthMm: number;
      readonly heightMm: number;
      readonly construction: boolean;
      readonly entityIds: readonly EntityId[];
    }
  | {
      readonly kind: "entity";
      readonly entity: Geometry;
    }
  | {
      readonly kind: "datum";
      readonly entityId: EntityId;
      readonly label: string;
    };

/**
 * Expand a clicked entity to all members of its rectangle feature (if any).
 */
export function entityIdsForSelectionTarget(
  constraints: readonly Constraint[],
  entityId: EntityId,
): EntityId[] {
  const feature = findRectangleFeatureForEntity(constraints, entityId);
  if (feature === null) {
    return [entityId];
  }
  return [...rectangleEntityIds(feature)];
}

/**
 * Count logical selection units (one rectangle feature counts as 1).
 */
export function countLogicalSelection(
  constraints: readonly Constraint[],
  selectedIds: readonly EntityId[],
): number {
  const consumed = new Set<EntityId>();
  let count = 0;

  for (const entityId of selectedIds) {
    if (consumed.has(entityId)) {
      continue;
    }
    const feature = findRectangleFeatureForEntity(constraints, entityId);
    if (feature !== null) {
      for (const id of rectangleEntityIds(feature)) {
        consumed.add(id);
      }
      count += 1;
      continue;
    }
    consumed.add(entityId);
    count += 1;
  }

  return count;
}

/**
 * Human-facing selection summary for the Properties panel.
 * Rectangle members collapse to a single rectangle entry (W×H).
 */
export function summarizeSelection(
  geometry: readonly Geometry[],
  constraints: readonly Constraint[],
  selectedIds: readonly EntityId[],
  frame?: SketchFrame,
): SelectionSummaryItem[] {
  if (selectedIds.length === 0) {
    return [];
  }

  const selectedSet = new Set(selectedIds);
  const items: SelectionSummaryItem[] = [];
  const consumed = new Set<EntityId>();
  const seenFeatures = new Set<string>();

  for (const entityId of selectedIds) {
    if (consumed.has(entityId)) {
      continue;
    }

    if (frame !== undefined) {
      const datumLabel = datumDisplayName(frame, entityId);
      if (datumLabel !== null) {
        consumed.add(entityId);
        items.push({ kind: "datum", entityId, label: datumLabel });
        continue;
      }
    }

    const feature = findRectangleFeatureForEntity(constraints, entityId);
    if (feature !== null && !seenFeatures.has(feature.constraintId)) {
      seenFeatures.add(feature.constraintId);
      const memberIds = rectangleEntityIds(feature);
      for (const id of memberIds) {
        consumed.add(id);
      }

      // Only summarize if at least one member is selected.
      const anySelected = [...memberIds].some((id) => selectedSet.has(id));
      if (!anySelected) {
        continue;
      }

      const rectangleItem = describeRectangle(geometry, feature);
      if (rectangleItem !== null) {
        items.push(rectangleItem);
        continue;
      }
    }

    if (consumed.has(entityId)) {
      continue;
    }

    const entity = geometry.find((item) => item.id === entityId);
    if (entity !== undefined) {
      consumed.add(entityId);
      items.push({ kind: "entity", entity });
    }
  }

  return items;
}

export function formatSelectionSummaryItem(item: SelectionSummaryItem): string {
  if (item.kind === "rectangle") {
    const tag = item.construction ? " · construction" : "";
    return `Rectangle ${item.constraintId} · W ${format(item.widthMm)} × H ${format(item.heightMm)} mm${tag}`;
  }
  if (item.kind === "datum") {
    return `${item.label} (fixed)`;
  }
  return formatEntity(item.entity);
}

function describeRectangle(
  geometry: readonly Geometry[],
  feature: RectangleFeatureIds,
): SelectionSummaryItem | null {
  const corners = readRectangleCorners(geometry, feature);
  if (corners === null) {
    return null;
  }
  const metrics = rectangleMetrics(corners);
  const sample = geometry.find((entity) =>
    rectangleEntityIds(feature).has(entity.id),
  );
  return {
    kind: "rectangle",
    constraintId: feature.constraintId,
    widthMm: metrics.widthMm,
    heightMm: metrics.heightMm,
    construction: sample?.construction ?? false,
    entityIds: [...rectangleEntityIds(feature)],
  };
}

function formatEntity(entity: Geometry): string {
  const tag = entity.construction ? " · construction" : "";
  switch (entity.type) {
    case "point":
      return `Point ${entity.id} @ (${format(entity.position.x)}, ${format(entity.position.y)})${tag}`;
    case "line":
      return `Line ${entity.id} · L ${format(distance(entity.start, entity.end))} mm${tag}`;
    case "circle":
      return `Circle ${entity.id} · R ${format(entity.radius)} mm${tag}`;
    case "arc": {
      const sweepDeg =
        (arcSweepRadians(entity.startAngle, entity.endAngle) * 180) / Math.PI;
      return `Arc ${entity.id} · R ${format(entity.radius)} mm · sweep ${format(sweepDeg)}°${tag}`;
    }
  }
}

function format(value: number): string {
  return value.toFixed(2);
}
