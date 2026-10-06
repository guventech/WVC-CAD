import type { Constraint } from "./Constraint.ts";
import { isDrivingConstraint } from "./Constraint.ts";
import type { EntityId, Geometry } from "./Geometry.ts";
import type { Sketch } from "./Sketch.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import { distance, TOLERANCE } from "../geometry/GeometryMath.ts";
import type { RectangleCornerKey, RectangleEdgeKey } from "../geometry/RectangleMath.ts";
import {
  parseChamferFeature,
  parseFilletFeature,
} from "./FilletChamferFeature.ts";
import {
  edgeKeyForLine,
  findRectangleFeatureForEntity,
  parseRectangleFeature,
  rectangleEntityIds,
  type RectangleFeatureIds,
} from "./RectangleFeature.ts";

/** Adjacent edge pairs that meet at each rectangle corner. */
const CORNER_EDGES: Record<
  RectangleCornerKey,
  readonly [RectangleEdgeKey, RectangleEdgeKey]
> = {
  bl: ["left", "bottom"],
  br: ["bottom", "right"],
  tr: ["right", "top"],
  tl: ["top", "left"],
};

const CORNER_ROLE: Record<RectangleCornerKey, `corner-${RectangleCornerKey}`> = {
  bl: "corner-bl",
  br: "corner-br",
  tr: "corner-tr",
  tl: "corner-tl",
};

/**
 * Which rectangle corner is shared by two edge lines, if any.
 */
export function rectangleCornerBetweenEdges(
  feature: RectangleFeatureIds,
  edgeA: EntityId,
  edgeB: EntityId,
): RectangleCornerKey | null {
  const a = edgeKeyForLine(feature, edgeA);
  const b = edgeKeyForLine(feature, edgeB);
  if (a === null || b === null || a === b) {
    return null;
  }
  for (const [corner, edges] of Object.entries(CORNER_EDGES) as [
    RectangleCornerKey,
    readonly [RectangleEdgeKey, RectangleEdgeKey],
  ][]) {
    if (
      (edges[0] === a && edges[1] === b) ||
      (edges[0] === b && edges[1] === a)
    ) {
      return corner;
    }
  }
  return null;
}

/**
 * Drop any coincident that forces two lines' endpoints together.
 * Required for successive rectangle-corner fillets: after a corner is opened,
 * later corners still had edge↔edge coincidents that pulled endpoints back
 * together and blocked the blend.
 */
export function removeLinePairCoincident(
  sketch: Sketch,
  line1Id: EntityId,
  line2Id: EntityId,
): Sketch {
  const constraints = sketch.constraints.filter((constraint) => {
    if (constraint.type !== "coincident" || constraint.references.length !== 2) {
      return true;
    }
    const ids = new Set(constraint.references.map((ref) => ref.entityId));
    return !(ids.has(line1Id) && ids.has(line2Id));
  });
  if (constraints.length === sketch.constraints.length) {
    return sketch;
  }
  return { ...sketch, constraints };
}

/** Remove point entities that sit on the filleted corner (orphaned rectangle corners). */
export function removePointsNearCorner(
  sketch: Sketch,
  corner: Point2D,
  keepEntityIds: ReadonlySet<EntityId> = new Set(),
): Sketch {
  const removeIds = new Set<EntityId>();
  for (const entity of sketch.geometry) {
    if (entity.type !== "point" || keepEntityIds.has(entity.id)) {
      continue;
    }
    if (distance(entity.position, corner) <= TOLERANCE.coincidence * 10) {
      removeIds.add(entity.id);
    }
  }
  if (removeIds.size === 0) {
    return sketch;
  }
  return {
    ...sketch,
    geometry: sketch.geometry.filter((entity) => !removeIds.has(entity.id)),
    constraints: sketch.constraints.filter(
      (constraint) =>
        !constraint.references.some((ref) => removeIds.has(ref.entityId)),
    ),
  };
}

/**
 * After filleting/chamfering a rectangle corner, open that corner on the
 * rectangle feature (drop the corner point + topology) but keep the feature
 * and its four edges so Offset / drag still treat the profile as one group.
 * Always removes the edge↔edge coincident for the edited corner.
 */
export function dissolveRectangleAtCorner(
  sketch: Sketch,
  line1Id: EntityId,
  line2Id: EntityId,
  cornerPoint?: Point2D,
): Sketch {
  // Always clear the meeting coincident for these two lines.
  let next = removeLinePairCoincident(sketch, line1Id, line2Id);

  const feature = findRectangleFeatureForEntity(next.constraints, line1Id);
  if (feature !== null) {
    const corner = rectangleCornerBetweenEdges(feature, line1Id, line2Id);
    if (corner !== null) {
      const cornerPointId = feature.corners[corner];
      const cornerRole = CORNER_ROLE[corner];
      const removeEntityIds = new Set<EntityId>();
      if (cornerPointId !== null) {
        removeEntityIds.add(cornerPointId);
      }
      const removeConstraintIds = new Set<string>();

      for (const constraint of next.constraints) {
        if (
          cornerPointId !== null &&
          constraint.type === "coincident" &&
          constraint.references.some((ref) => ref.entityId === cornerPointId)
        ) {
          removeConstraintIds.add(constraint.id);
        }
      }

      next = {
        ...next,
        geometry: next.geometry.filter(
          (entity) => !removeEntityIds.has(entity.id),
        ),
        constraints: next.constraints
          .filter((constraint) => !removeConstraintIds.has(constraint.id))
          .map((constraint) => {
            if (constraint.id !== feature.constraintId) {
              return constraint;
            }
            return {
              ...constraint,
              references: constraint.references.filter(
                (ref) => ref.role !== cornerRole,
              ),
            };
          }),
      };
    }
  }

  if (cornerPoint !== undefined) {
    next = removePointsNearCorner(next, cornerPoint);
  }

  return next;
}

/** True when both lines belong to the same rectangle feature. */
export function linesShareRectangle(
  sketch: Sketch,
  line1Id: EntityId,
  line2Id: EntityId,
): boolean {
  const feature = findRectangleFeatureForEntity(sketch.constraints, line1Id);
  if (feature === null) {
    return false;
  }
  return rectangleCornerBetweenEdges(feature, line1Id, line2Id) !== null;
}

export function rectangleFeatureStillPresent(
  constraints: readonly Constraint[],
  constraintId: string,
): boolean {
  return constraints.some(
    (constraint) =>
      constraint.id === constraintId && parseRectangleFeature(constraint) !== null,
  );
}

/**
 * Resolve the rectangle feature that owns an edge/corner, or a fillet/chamfer
 * attached to that rectangle's edges.
 */
export function findRectangleFeatureForGroupMember(
  sketch: Sketch,
  entityId: EntityId,
): RectangleFeatureIds | null {
  const direct = findRectangleFeatureForEntity(sketch.constraints, entityId);
  if (direct !== null) {
    return direct;
  }

  for (const constraint of sketch.constraints) {
    const fillet = parseFilletFeature(constraint);
    if (fillet !== null && fillet.arcId === entityId) {
      return (
        findRectangleFeatureForEntity(sketch.constraints, fillet.line1Id) ??
        findRectangleFeatureForEntity(sketch.constraints, fillet.line2Id)
      );
    }
    const chamfer = parseChamferFeature(constraint);
    if (chamfer !== null && chamfer.chamferLineId === entityId) {
      return (
        findRectangleFeatureForEntity(sketch.constraints, chamfer.line1Id) ??
        findRectangleFeatureForEntity(sketch.constraints, chamfer.line2Id)
      );
    }
  }
  return null;
}

/**
 * Entity ids that move together for Offset / rigid locate on a rectangle:
 * edges, remaining corners, and fillet/chamfer geometry on those edges.
 */
export function rectangleGroupEntityIds(
  sketch: Sketch,
  feature: RectangleFeatureIds,
): ReadonlySet<EntityId> {
  const ids = new Set(rectangleEntityIds(feature));
  const edges = new Set([
    feature.edges.bottom,
    feature.edges.right,
    feature.edges.top,
    feature.edges.left,
  ]);

  for (const constraint of sketch.constraints) {
    const fillet = parseFilletFeature(constraint);
    if (
      fillet !== null &&
      edges.has(fillet.line1Id) &&
      edges.has(fillet.line2Id)
    ) {
      ids.add(fillet.arcId);
      continue;
    }
    const chamfer = parseChamferFeature(constraint);
    if (
      chamfer !== null &&
      edges.has(chamfer.line1Id) &&
      edges.has(chamfer.line2Id)
    ) {
      ids.add(chamfer.chamferLineId);
    }
  }
  return ids;
}

/**
 * True when another driving Offset on the same axis already pins a different
 * member of this rectangle group. That means a further Offset edit is sizing
 * (move one edge), not locating (rigid-translate the group).
 */
export function otherDrivingSameAxisOffset(
  sketch: Sketch,
  feature: RectangleFeatureIds,
  axis: "coordinate-x" | "coordinate-y",
  excludeConstraintId: string,
): boolean {
  const groupIds = rectangleGroupEntityIds(sketch, feature);
  for (const constraint of sketch.constraints) {
    if (constraint.id === excludeConstraintId || constraint.type !== axis) {
      continue;
    }
    if (!isDrivingConstraint(constraint)) {
      continue;
    }
    const entityId = constraint.references[0]?.entityId;
    if (entityId !== undefined && groupIds.has(entityId)) {
      return true;
    }
  }
  return false;
}

/** Translate every geometry entity in `ids` by `delta` (world mm). */
export function translateGeometryByIds(
  geometry: readonly Geometry[],
  ids: ReadonlySet<EntityId>,
  delta: Point2D,
): Geometry[] {
  if (
    ids.size === 0 ||
    (Math.abs(delta.x) <= TOLERANCE.geometric &&
      Math.abs(delta.y) <= TOLERANCE.geometric)
  ) {
    return [...geometry];
  }

  return geometry.map((entity) => {
    if (!ids.has(entity.id)) {
      return entity;
    }
    switch (entity.type) {
      case "point":
        return {
          ...entity,
          position: {
            x: entity.position.x + delta.x,
            y: entity.position.y + delta.y,
          },
        };
      case "line":
        return {
          ...entity,
          start: {
            x: entity.start.x + delta.x,
            y: entity.start.y + delta.y,
          },
          end: {
            x: entity.end.x + delta.x,
            y: entity.end.y + delta.y,
          },
        };
      case "circle":
      case "arc":
        return {
          ...entity,
          center: {
            x: entity.center.x + delta.x,
            y: entity.center.y + delta.y,
          },
        };
    }
  });
}
