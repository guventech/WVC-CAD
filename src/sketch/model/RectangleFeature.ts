import type { Constraint, ConstraintId } from "./Constraint.ts";
import type { EntityId, Geometry, LineGeometry, PointGeometry } from "./Geometry.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import { TOLERANCE } from "../geometry/GeometryMath.ts";
import { intersectInfiniteLines } from "../geometry/Intersections.ts";
import type {
  RectangleCornerKey,
  RectangleCorners,
  RectangleEdgeKey,
} from "../geometry/RectangleMath.ts";

export interface RectangleFeatureIds {
  readonly constraintId: ConstraintId;
  /** Corner point ids; null when that corner has been filleted/chamfered. */
  readonly corners: {
    readonly bl: EntityId | null;
    readonly br: EntityId | null;
    readonly tr: EntityId | null;
    readonly tl: EntityId | null;
  };
  readonly edges: {
    readonly bottom: EntityId;
    readonly right: EntityId;
    readonly top: EntityId;
    readonly left: EntityId;
  };
}

export function isRectangleConstraint(
  constraint: Constraint,
): constraint is Constraint & { readonly type: "rectangle" } {
  if (constraint.type !== "rectangle") {
    return false;
  }
  const roles = new Set(constraint.references.map((ref) => ref.role));
  return (
    roles.has("edge-bottom") &&
    roles.has("edge-right") &&
    roles.has("edge-top") &&
    roles.has("edge-left")
  );
}

export function parseRectangleFeature(
  constraint: Constraint,
): RectangleFeatureIds | null {
  if (!isRectangleConstraint(constraint)) {
    return null;
  }

  const byRole = new Map(
    constraint.references.map((reference) => [reference.role, reference.entityId]),
  );

  const bottom = byRole.get("edge-bottom");
  const right = byRole.get("edge-right");
  const top = byRole.get("edge-top");
  const left = byRole.get("edge-left");

  if (
    bottom === undefined ||
    right === undefined ||
    top === undefined ||
    left === undefined
  ) {
    return null;
  }

  return {
    constraintId: constraint.id,
    corners: {
      bl: byRole.get("corner-bl") ?? null,
      br: byRole.get("corner-br") ?? null,
      tr: byRole.get("corner-tr") ?? null,
      tl: byRole.get("corner-tl") ?? null,
    },
    edges: { bottom, right, top, left },
  };
}

export function findRectangleFeatureForEntity(
  constraints: readonly Constraint[],
  entityId: EntityId,
): RectangleFeatureIds | null {
  for (const constraint of constraints) {
    const feature = parseRectangleFeature(constraint);
    if (feature === null) {
      continue;
    }
    const ids = rectangleEntityIds(feature);
    if (ids.has(entityId)) {
      return feature;
    }
  }
  return null;
}

export function rectangleEntityIds(
  feature: RectangleFeatureIds,
): ReadonlySet<EntityId> {
  const ids = new Set<EntityId>([
    feature.edges.bottom,
    feature.edges.right,
    feature.edges.top,
    feature.edges.left,
  ]);
  for (const cornerId of [
    feature.corners.bl,
    feature.corners.br,
    feature.corners.tr,
    feature.corners.tl,
  ]) {
    if (cornerId !== null) {
      ids.add(cornerId);
    }
  }
  return ids;
}

export function cornerKeyForPoint(
  feature: RectangleFeatureIds,
  pointId: EntityId,
): RectangleCornerKey | null {
  if (feature.corners.bl === pointId) {
    return "bl";
  }
  if (feature.corners.br === pointId) {
    return "br";
  }
  if (feature.corners.tr === pointId) {
    return "tr";
  }
  if (feature.corners.tl === pointId) {
    return "tl";
  }
  return null;
}

export function edgeKeyForLine(
  feature: RectangleFeatureIds,
  lineId: EntityId,
): RectangleEdgeKey | null {
  if (feature.edges.bottom === lineId) {
    return "bottom";
  }
  if (feature.edges.right === lineId) {
    return "right";
  }
  if (feature.edges.top === lineId) {
    return "top";
  }
  if (feature.edges.left === lineId) {
    return "left";
  }
  return null;
}

/** Map a rectangle edge endpoint hit to the corresponding corner point id. */
export function cornerPointIdForEdgeEndpoint(
  feature: RectangleFeatureIds,
  edgeLineId: EntityId,
  which: "start" | "end",
): EntityId | null {
  const edge = edgeKeyForLine(feature, edgeLineId);
  if (edge === null) {
    return null;
  }

  switch (edge) {
    case "bottom":
      return which === "start" ? feature.corners.bl : feature.corners.br;
    case "right":
      return which === "start" ? feature.corners.br : feature.corners.tr;
    case "top":
      return which === "start" ? feature.corners.tr : feature.corners.tl;
    case "left":
      return which === "start" ? feature.corners.tl : feature.corners.bl;
  }
}

export function readRectangleCorners(
  geometry: readonly Geometry[],
  feature: RectangleFeatureIds,
): RectangleCorners | null {
  const bottom = lineEntity(geometry, feature.edges.bottom);
  const right = lineEntity(geometry, feature.edges.right);
  const top = lineEntity(geometry, feature.edges.top);
  const left = lineEntity(geometry, feature.edges.left);
  if (bottom === null || right === null || top === null || left === null) {
    return null;
  }

  const bl =
    pointPosition(geometry, feature.corners.bl) ??
    intersectCorner(left, bottom);
  const br =
    pointPosition(geometry, feature.corners.br) ??
    intersectCorner(bottom, right);
  const tr =
    pointPosition(geometry, feature.corners.tr) ??
    intersectCorner(right, top);
  const tl =
    pointPosition(geometry, feature.corners.tl) ??
    intersectCorner(top, left);
  if (bl === null || br === null || tr === null || tl === null) {
    return null;
  }
  return { bl, br, tr, tl };
}

export function applyRectangleCornersToGeometry(
  geometry: readonly Geometry[],
  feature: RectangleFeatureIds,
  corners: RectangleCorners,
): Geometry[] {
  const pointPositions = new Map<EntityId, Point2D>();
  if (feature.corners.bl !== null) {
    pointPositions.set(feature.corners.bl, corners.bl);
  }
  if (feature.corners.br !== null) {
    pointPositions.set(feature.corners.br, corners.br);
  }
  if (feature.corners.tr !== null) {
    pointPositions.set(feature.corners.tr, corners.tr);
  }
  if (feature.corners.tl !== null) {
    pointPositions.set(feature.corners.tl, corners.tl);
  }

  const edgeEndpoints = new Map<EntityId, { start: Point2D; end: Point2D }>([
    [feature.edges.bottom, { start: corners.bl, end: corners.br }],
    [feature.edges.right, { start: corners.br, end: corners.tr }],
    [feature.edges.top, { start: corners.tr, end: corners.tl }],
    [feature.edges.left, { start: corners.tl, end: corners.bl }],
  ]);

  return geometry.map((entity) => {
    const point = pointPositions.get(entity.id);
    if (point !== undefined && entity.type === "point") {
      return { ...entity, position: { x: point.x, y: point.y } } satisfies PointGeometry;
    }
    const edge = edgeEndpoints.get(entity.id);
    if (edge !== undefined && entity.type === "line") {
      return {
        ...entity,
        start: { x: edge.start.x, y: edge.start.y },
        end: { x: edge.end.x, y: edge.end.y },
      } satisfies LineGeometry;
    }
    return entity;
  });
}

function pointPosition(
  geometry: readonly Geometry[],
  id: EntityId | null,
): Point2D | null {
  if (id === null) {
    return null;
  }
  const entity = geometry.find((item) => item.id === id);
  if (entity?.type !== "point") {
    return null;
  }
  return { x: entity.position.x, y: entity.position.y };
}

function lineEntity(
  geometry: readonly Geometry[],
  id: EntityId,
): LineGeometry | null {
  const entity = geometry.find((item) => item.id === id);
  return entity?.type === "line" ? entity : null;
}

function intersectCorner(
  a: LineGeometry,
  b: LineGeometry,
): Point2D | null {
  const hit = intersectInfiniteLines(
    a.start,
    a.end,
    b.start,
    b.end,
    TOLERANCE.coincidence,
  );
  return hit?.point ?? null;
}
