import type { Constraint } from "./Constraint.ts";
import { isDrivingConstraint } from "./Constraint.ts";
import type { EntityId, Geometry } from "./Geometry.ts";
import type { Sketch } from "./Sketch.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import { distance, TOLERANCE } from "../geometry/GeometryMath.ts";
import type { RectangleCornerKey, RectangleEdgeKey } from "../geometry/RectangleMath.ts";
import { createEntityId } from "./EntityId.ts";
import { createCoordinateConstraint } from "../constraints/ConstraintFactory.ts";
import {
  findFrameAxis,
  isDatumOriginId,
} from "./SketchFrame.ts";
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
 * Endpoint of each edge at a corner, and which world axis that edge should
 * stay on when a datum locate is migrated off the deleted corner point.
 * Origin → both axes; axis X/Y → only the matching edge endpoint.
 */
const CORNER_DATUM_ENDS: Record<
  RectangleCornerKey,
  readonly {
    readonly edge: RectangleEdgeKey;
    readonly which: "start" | "end";
    readonly axisTag: "x" | "y";
  }[]
> = {
  bl: [
    { edge: "bottom", which: "start", axisTag: "x" },
    { edge: "left", which: "end", axisTag: "y" },
  ],
  br: [
    { edge: "bottom", which: "end", axisTag: "x" },
    { edge: "right", which: "start", axisTag: "y" },
  ],
  tr: [
    { edge: "right", which: "end", axisTag: "y" },
    { edge: "top", which: "start", axisTag: "x" },
  ],
  tl: [
    { edge: "top", which: "end", axisTag: "x" },
    { edge: "left", which: "start", axisTag: "y" },
  ],
};

/**
 * After filleting/chamfering a rectangle corner, open that corner on the
 * rectangle feature (drop the corner point + topology) but keep the feature
 * and its four edges so Offset / drag still treat the profile as one group.
 * Always removes the edge↔edge coincident for the edited corner.
 * Datum coincidents on the corner point migrate onto surviving edge endpoints
 * on the matching world axes so axis-locked sides do not float.
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
      const migrated: Constraint[] = [];

      if (cornerPointId !== null) {
        const migration = migrateDatumCoincidentsFromCorner(
          next,
          feature,
          corner,
          cornerPointId,
        );
        for (const id of migration.removeIds) {
          removeConstraintIds.add(id);
        }
        migrated.push(...migration.add);
      }

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
        constraints: [
          ...next.constraints
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
          ...migrated,
        ],
      };
    }
  }

  if (cornerPoint !== undefined) {
    next = removePointsNearCorner(next, cornerPoint);
  }

  return next;
}

/**
 * Move origin/axis coincidents off a deleted rectangle corner point onto the
 * surviving edges as driving coordinate locate (0 mm).
 *
 * Common parametric CAD practice: locate with offset-to-axis / dimensions to
 * the straight edges — not only endpoint↔axis coincidents — so fillets that
 * consume corners do not drop the axis lock (sketch-12: Y stayed via
 * coordinate-x, X floated when coordinate-y was missing).
 */
export function migrateDatumCoincidentsFromCorner(
  sketch: Sketch,
  feature: RectangleFeatureIds,
  corner: RectangleCornerKey,
  cornerPointId: EntityId,
): { readonly removeIds: readonly string[]; readonly add: readonly Constraint[] } {
  const removeIds: string[] = [];
  const add: Constraint[] = [];
  const ends = CORNER_DATUM_ENDS[corner];
  const wantAxisTags = new Set<"x" | "y">();

  for (const constraint of sketch.constraints) {
    if (
      constraint.type !== "coincident" ||
      !constraint.references.some((ref) => ref.entityId === cornerPointId)
    ) {
      continue;
    }
    const other = constraint.references.find(
      (ref) => ref.entityId !== cornerPointId,
    );
    if (other === undefined) {
      continue;
    }
    if (isDatumOriginId(sketch.frame, other.entityId)) {
      removeIds.push(constraint.id);
      wantAxisTags.add("x");
      wantAxisTags.add("y");
      continue;
    }
    const axis = findFrameAxis(sketch.frame, other.entityId);
    if (axis !== null) {
      removeIds.push(constraint.id);
      wantAxisTags.add(axis.tag);
    }
  }

  const pendingCoords = new Set<"coordinate-x" | "coordinate-y">();
  for (const end of ends) {
    if (!wantAxisTags.has(end.axisTag)) {
      continue;
    }
    // World X-axis → pin Y (coordinate-y); world Y-axis → pin X (coordinate-x).
    const coordType =
      end.axisTag === "x" ? "coordinate-y" : "coordinate-x";
    const edgeId = feature.edges[end.edge];
    if (
      pendingCoords.has(coordType) ||
      edgeHasDrivingCoordinate(sketch, edgeId, coordType) ||
      rectangleHasDrivingCoordinate(sketch, feature, coordType)
    ) {
      continue;
    }
    pendingCoords.add(coordType);
    add.push(
      createCoordinateConstraint(
        createEntityId("constraint"),
        coordType,
        edgeId,
        0,
        { role: "start", driving: true },
      ),
    );
  }

  return { removeIds, add };
}

function edgeHasDrivingCoordinate(
  sketch: Sketch,
  edgeId: EntityId,
  type: "coordinate-x" | "coordinate-y",
): boolean {
  return sketch.constraints.some(
    (constraint) =>
      constraint.type === type &&
      isDrivingConstraint(constraint) &&
      constraint.references[0]?.entityId === edgeId,
  );
}

function rectangleHasDrivingCoordinate(
  sketch: Sketch,
  feature: RectangleFeatureIds,
  type: "coordinate-x" | "coordinate-y",
): boolean {
  const edgeIds = new Set([
    feature.edges.bottom,
    feature.edges.right,
    feature.edges.top,
    feature.edges.left,
  ]);
  return sketch.constraints.some(
    (constraint) =>
      constraint.type === type &&
      isDrivingConstraint(constraint) &&
      constraint.references[0] !== undefined &&
      edgeIds.has(constraint.references[0].entityId),
  );
}

/**
 * Convert leftover edge↔axis coincidents into durable coordinate locate.
 * Does **not** invent missing opposite-axis pins (ADR-051): pose must be
 * correct from create/fillet, not repaired by guessing on load.
 */
export function restoreFilletedRectangleAxisCoordinates(sketch: Sketch): Sketch {
  let next = sketch;
  for (const constraint of sketch.constraints) {
    const feature = parseRectangleFeature(constraint);
    if (feature === null) {
      continue;
    }
    const hasFillet = next.constraints.some((item) => {
      const fillet = parseFilletFeature(item);
      if (fillet === null) {
        return false;
      }
      return (
        edgeKeyForLine(feature, fillet.line1Id) !== null &&
        edgeKeyForLine(feature, fillet.line2Id) !== null
      );
    });
    if (!hasFillet) {
      continue;
    }
    next = convertEdgeAxisCoincidentsToCoordinates(next, feature);
  }
  return next;
}

function convertEdgeAxisCoincidentsToCoordinates(
  sketch: Sketch,
  feature: RectangleFeatureIds,
): Sketch {
  const removeIds = new Set<string>();
  const add: Constraint[] = [];
  const edgeById = new Map<EntityId, RectangleEdgeKey>([
    [feature.edges.bottom, "bottom"],
    [feature.edges.right, "right"],
    [feature.edges.top, "top"],
    [feature.edges.left, "left"],
  ]);

  for (const constraint of sketch.constraints) {
    if (constraint.type !== "coincident" || constraint.references.length < 2) {
      continue;
    }
    const edgeRef = constraint.references.find((ref) =>
      edgeById.has(ref.entityId),
    );
    const other = constraint.references.find(
      (ref) => ref.entityId !== edgeRef?.entityId,
    );
    if (edgeRef === undefined || other === undefined) {
      continue;
    }
    const axis = findFrameAxis(sketch.frame, other.entityId);
    if (axis === null) {
      continue;
    }
    const edgeKey = edgeById.get(edgeRef.entityId)!;
    const coordType =
      axis.tag === "x" ? "coordinate-y" : "coordinate-x";
    // Only convert when the edge is the one that should sit on that axis.
    if (
      (coordType === "coordinate-y" &&
        edgeKey !== "bottom" &&
        edgeKey !== "top") ||
      (coordType === "coordinate-x" &&
        edgeKey !== "left" &&
        edgeKey !== "right")
    ) {
      continue;
    }
    removeIds.add(constraint.id);
    if (
      !edgeHasDrivingCoordinate(sketch, edgeRef.entityId, coordType) &&
      !add.some((item) => item.type === coordType)
    ) {
      add.push(
        createCoordinateConstraint(
          createEntityId("constraint"),
          coordType,
          edgeRef.entityId,
          0,
          { role: "start", driving: true },
        ),
      );
    }
  }

  if (removeIds.size === 0 && add.length === 0) {
    return sketch;
  }
  return {
    ...sketch,
    constraints: [
      ...sketch.constraints.filter((c) => !removeIds.has(c.id)),
      ...add,
    ],
  };
}

/**
 * Convert driving `length` on trimmed rectangle edges into outer-size spans
 * between opposite sides (H-distance for top/bottom, V-distance for left/right).
 * Keeps the numeric value the user entered as overall width/height so fillets
 * can exist without pushing axis-locked edges off the datums.
 */
export function promoteRectangleEdgeLengthsToOuterSpans(
  sketch: Sketch,
  edgeIds: readonly EntityId[],
): Sketch {
  const feature = findRectangleFeatureForEntity(sketch.constraints, edgeIds[0]!);
  if (feature === null) {
    return sketch;
  }
  for (const edgeId of edgeIds) {
    if (edgeKeyForLine(feature, edgeId) === null) {
      return sketch;
    }
  }

  return promoteLengthsOnRectangleEdges(sketch, feature, new Set(edgeIds));
}

/**
 * Promote driving `length` on every rectangle edge that already has a
 * fillet/chamfer. Used after corner edit and on load so saved sketches that
 * still store segment lengths (sketch-11) heal instead of floating off axes.
 */
export function promoteFilletedRectangleEdgeLengths(sketch: Sketch): Sketch {
  let next = sketch;
  for (const constraint of sketch.constraints) {
    const feature = parseRectangleFeature(constraint);
    if (feature === null) {
      continue;
    }
    const filletedEdges = new Set<EntityId>();
    for (const item of next.constraints) {
      const fillet = parseFilletFeature(item);
      if (fillet !== null) {
        if (edgeKeyForLine(feature, fillet.line1Id) !== null) {
          filletedEdges.add(fillet.line1Id);
        }
        if (edgeKeyForLine(feature, fillet.line2Id) !== null) {
          filletedEdges.add(fillet.line2Id);
        }
      }
      const chamfer = parseChamferFeature(item);
      if (chamfer !== null) {
        if (edgeKeyForLine(feature, chamfer.line1Id) !== null) {
          filletedEdges.add(chamfer.line1Id);
        }
        if (edgeKeyForLine(feature, chamfer.line2Id) !== null) {
          filletedEdges.add(chamfer.line2Id);
        }
      }
    }
    if (filletedEdges.size === 0) {
      continue;
    }
    next = promoteLengthsOnRectangleEdges(next, feature, filletedEdges);
  }
  return next;
}

function promoteLengthsOnRectangleEdges(
  sketch: Sketch,
  feature: RectangleFeatureIds,
  edgeIds: ReadonlySet<EntityId>,
): Sketch {
  let changed = false;
  const constraints = sketch.constraints.map((constraint) => {
    if (
      constraint.type !== "length" ||
      !isDrivingConstraint(constraint) ||
      constraint.references[0] === undefined ||
      !edgeIds.has(constraint.references[0].entityId)
    ) {
      return constraint;
    }
    const edge = edgeKeyForLine(feature, constraint.references[0].entityId);
    if (edge === null) {
      return constraint;
    }
    changed = true;
    if (edge === "top" || edge === "bottom") {
      return {
        ...constraint,
        type: "horizontal-distance" as const,
        references: [
          { entityId: feature.edges.left, role: "start" as const },
          { entityId: feature.edges.right, role: "start" as const },
        ],
      };
    }
    return {
      ...constraint,
      type: "vertical-distance" as const,
      references: [
        { entityId: feature.edges.bottom, role: "start" as const },
        { entityId: feature.edges.top, role: "start" as const },
      ],
    };
  });

  return changed ? { ...sketch, constraints } : sketch;
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
