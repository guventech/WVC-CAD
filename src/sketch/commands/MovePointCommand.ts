import {
  distance,
  isApproximatelyEqual,
  pointsApproximatelyEqual,
  TOLERANCE,
} from "../geometry/GeometryMath.ts";
import {
  moveRectangleCorner,
  moveRectangleEdge,
} from "../geometry/RectangleMath.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import {
  applyRectangleCornersToGeometry,
  cornerKeyForPoint,
  edgeKeyForLine,
  findRectangleFeatureForEntity,
  readRectangleCorners,
  rectangleEntityIds,
} from "../model/RectangleFeature.ts";
import { findFilletFeatureForEntity } from "../model/FilletChamferFeature.ts";
import {
  rebuildAllCornerFeatures,
  rebuildCornerFeaturesTouching,
  rebuildFilletGeometry,
} from "../geometry/FilletChamferOps.ts";
import type { EntityId, Geometry, LineGeometry } from "../model/Geometry.ts";
import type { Sketch } from "../model/Sketch.ts";
import type { SketchCommand } from "./Command.ts";
import type { GeometryDragTarget } from "./GeometryDrag.ts";

export type { GeometryDragTarget } from "./GeometryDrag.ts";

function rebuildAfterRectangleEdgeMove(
  sketch: Sketch,
  feature: NonNullable<ReturnType<typeof findRectangleFeatureForEntity>>,
  edgeEntityId: EntityId,
): Sketch {
  const openCorner =
    feature.corners.bl === null ||
    feature.corners.br === null ||
    feature.corners.tr === null ||
    feature.corners.tl === null;
  // applyRectangleCorners untrims all edges; rebuild every blend so opposite
  // sides are not left at outer corners fighting fillet topology residuals.
  return openCorner
    ? rebuildAllCornerFeatures(sketch)
    : rebuildCornerFeaturesTouching(sketch, edgeEntityId);
}

/** Apply a Select-tool geometry drag to `position` (absolute grab / handle point). */
export function applyGeometryDrag(
  sketch: Sketch,
  target: GeometryDragTarget,
  position: Point2D,
): Sketch {
  switch (target.kind) {
    case "point":
      return movePointInSketch(sketch, target.entityId, position);
    case "circle-center":
      return moveCircleCenterInSketch(sketch, target.entityId, position);
    case "circle-radius":
      return moveCircleRadiusInSketch(sketch, target.entityId, position);
    case "arc-center": {
      const moved = moveArcCenterInSketch(sketch, target.entityId, position);
      return rebuildCornerFeaturesTouching(moved, target.entityId);
    }
    case "arc-radius":
      return moveArcRadiusInSketch(sketch, target.entityId, position);
    case "line-endpoint": {
      const moved = moveLineEndpointInSketch(
        sketch,
        target.entityId,
        target.which,
        position,
      );
      return rebuildCornerFeaturesTouching(moved, target.entityId);
    }
    case "line-body": {
      const rectFeature = findRectangleFeatureForEntity(
        sketch.constraints,
        target.entityId,
      );
      const rectEdge =
        rectFeature !== null
          ? edgeKeyForLine(rectFeature, target.entityId)
          : null;
      if (rectFeature !== null && rectEdge !== null) {
        const moved = moveRectangleEdgeInSketch(
          sketch,
          target.entityId,
          position,
        );
        return rebuildAfterRectangleEdgeMove(moved, rectFeature, target.entityId);
      }
      const moved = moveLineBodyInSketch(
        sketch,
        target.entityId,
        target.grabOffset,
        target.span,
        position,
      );
      return rebuildCornerFeaturesTouching(moved, target.entityId);
    }
    case "rectangle-edge": {
      const rectFeature = findRectangleFeatureForEntity(
        sketch.constraints,
        target.entityId,
      );
      const moved = moveRectangleEdgeInSketch(
        sketch,
        target.entityId,
        position,
      );
      if (rectFeature === null) {
        return moved;
      }
      return rebuildAfterRectangleEdgeMove(moved, rectFeature, target.entityId);
    }
  }
}

/**
 * Legacy helper: move a point entity, or a circle/arc center when `entityId`
 * refers to those types. Prefer `applyGeometryDrag` for new call sites.
 */
export function moveDraggableInSketch(
  sketch: Sketch,
  entityId: EntityId,
  position: Point2D,
): Sketch {
  const entity = findGeometry(sketch, entityId);
  if (entity?.type === "circle") {
    return moveCircleCenterInSketch(sketch, entityId, position);
  }
  if (entity?.type === "arc") {
    return moveArcCenterInSketch(sketch, entityId, position);
  }
  return movePointInSketch(sketch, entityId, position);
}

export function excludeEntityIdsForDrag(
  sketch: Sketch,
  target: GeometryDragTarget,
): EntityId[] {
  if (target.kind === "rectangle-edge" || target.kind === "point") {
    const feature = findRectangleFeatureForEntity(
      sketch.constraints,
      target.entityId,
    );
    if (feature !== null) {
      return [...rectangleEntityIds(feature)];
    }
  }
  return [target.entityId];
}

export function moveArcCenterInSketch(
  sketch: Sketch,
  entityId: EntityId,
  center: Point2D,
): Sketch {
  let changed = false;

  const geometry = sketch.geometry.map((entity) => {
    if (entity.id !== entityId || entity.type !== "arc") {
      return entity;
    }
    if (pointsApproximatelyEqual(entity.center, center)) {
      return entity;
    }
    changed = true;
    return {
      ...entity,
      center: { x: center.x, y: center.y },
    };
  });

  if (!changed) {
    return sketch;
  }

  return {
    ...sketch,
    geometry,
  };
}

export function moveCircleCenterInSketch(
  sketch: Sketch,
  entityId: EntityId,
  center: Point2D,
): Sketch {
  let changed = false;

  const geometry = sketch.geometry.map((entity) => {
    if (entity.id !== entityId || entity.type !== "circle") {
      return entity;
    }
    if (pointsApproximatelyEqual(entity.center, center)) {
      return entity;
    }
    changed = true;
    return {
      ...entity,
      center: { x: center.x, y: center.y },
    };
  });

  if (!changed) {
    return sketch;
  }

  return {
    ...sketch,
    geometry,
  };
}

/** Set circle radius from distance(center, rimPoint); center stays fixed. */
export function moveCircleRadiusInSketch(
  sketch: Sketch,
  entityId: EntityId,
  rimPoint: Point2D,
): Sketch {
  const entity = findGeometry(sketch, entityId);
  if (entity?.type !== "circle") {
    return sketch;
  }

  const radius = distance(entity.center, rimPoint);
  if (!(radius > TOLERANCE.coincidence)) {
    return sketch;
  }
  if (isApproximatelyEqual(entity.radius, radius, TOLERANCE.coincidence)) {
    return sketch;
  }

  return {
    ...sketch,
    geometry: sketch.geometry.map((item) =>
      item.id === entityId && item.type === "circle"
        ? { ...item, radius }
        : item,
    ),
  };
}

/** Set arc radius from distance(center, rimPoint); center and angles stay fixed.
 * Fillet arcs rebuild connected line trims so the blend stays tangent.
 */
export function moveArcRadiusInSketch(
  sketch: Sketch,
  entityId: EntityId,
  rimPoint: Point2D,
): Sketch {
  const entity = findGeometry(sketch, entityId);
  if (entity?.type !== "arc") {
    return sketch;
  }

  const radius = distance(entity.center, rimPoint);
  if (!(radius > TOLERANCE.coincidence)) {
    return sketch;
  }
  if (isApproximatelyEqual(entity.radius, radius, TOLERANCE.coincidence)) {
    return sketch;
  }

  const fillet = findFilletFeatureForEntity(sketch.constraints, entityId);
  if (fillet !== null) {
    return rebuildFilletGeometry(sketch, fillet, radius) ?? sketch;
  }

  return {
    ...sketch,
    geometry: sketch.geometry.map((item) =>
      item.id === entityId && item.type === "arc" ? { ...item, radius } : item,
    ),
  };
}

export function moveLineEndpointInSketch(
  sketch: Sketch,
  entityId: EntityId,
  which: "start" | "end",
  position: Point2D,
): Sketch {
  const entity = findGeometry(sketch, entityId);
  if (entity?.type !== "line") {
    return sketch;
  }

  const nextStart = which === "start" ? position : entity.start;
  const nextEnd = which === "end" ? position : entity.end;
  if (pointsApproximatelyEqual(nextStart, nextEnd, TOLERANCE.coincidence)) {
    return sketch;
  }
  if (
    pointsApproximatelyEqual(entity.start, nextStart) &&
    pointsApproximatelyEqual(entity.end, nextEnd)
  ) {
    return sketch;
  }

  return replaceLine(sketch, entityId, nextStart, nextEnd);
}

export function moveLineBodyInSketch(
  sketch: Sketch,
  entityId: EntityId,
  grabOffset: Point2D,
  span: Point2D,
  grabPosition: Point2D,
): Sketch {
  const entity = findGeometry(sketch, entityId);
  if (entity?.type !== "line") {
    return sketch;
  }

  const nextStart = {
    x: grabPosition.x - grabOffset.x,
    y: grabPosition.y - grabOffset.y,
  };
  const nextEnd = {
    x: nextStart.x + span.x,
    y: nextStart.y + span.y,
  };

  if (pointsApproximatelyEqual(nextStart, nextEnd, TOLERANCE.coincidence)) {
    return sketch;
  }
  if (
    pointsApproximatelyEqual(entity.start, nextStart) &&
    pointsApproximatelyEqual(entity.end, nextEnd)
  ) {
    return sketch;
  }

  return replaceLine(sketch, entityId, nextStart, nextEnd);
}

export function moveRectangleEdgeInSketch(
  sketch: Sketch,
  edgeEntityId: EntityId,
  position: Point2D,
): Sketch {
  const feature = findRectangleFeatureForEntity(
    sketch.constraints,
    edgeEntityId,
  );
  if (feature === null) {
    return sketch;
  }

  const edge = edgeKeyForLine(feature, edgeEntityId);
  if (edge === null) {
    return sketch;
  }

  const current = readRectangleCorners(sketch.geometry, feature);
  if (current === null) {
    return sketch;
  }

  const nextCorners = moveRectangleEdge(current, edge, position);
  if (nextCorners === null) {
    return sketch;
  }

  return {
    ...sketch,
    geometry: applyRectangleCornersToGeometry(
      sketch.geometry,
      feature,
      nextCorners,
    ),
  };
}

export function movePointInSketch(
  sketch: Sketch,
  entityId: EntityId,
  position: Point2D,
): Sketch {
  const feature = findRectangleFeatureForEntity(sketch.constraints, entityId);
  if (feature !== null) {
    const corner = cornerKeyForPoint(feature, entityId);
    if (corner !== null) {
      const current = readRectangleCorners(sketch.geometry, feature);
      if (current !== null) {
        const nextCorners = moveRectangleCorner(current, corner, position);
        if (nextCorners === null) {
          return sketch;
        }
        return {
          ...sketch,
          geometry: applyRectangleCornersToGeometry(
            sketch.geometry,
            feature,
            nextCorners,
          ),
        };
      }
    }
  }

  let changed = false;

  const geometry = sketch.geometry.map((entity) => {
    if (entity.id !== entityId || entity.type !== "point") {
      return entity;
    }
    if (pointsApproximatelyEqual(entity.position, position)) {
      return entity;
    }
    changed = true;
    return {
      ...entity,
      position: { x: position.x, y: position.y },
    };
  });

  if (!changed) {
    return sketch;
  }

  return {
    ...sketch,
    geometry,
  };
}

function replaceLine(
  sketch: Sketch,
  entityId: EntityId,
  start: Point2D,
  end: Point2D,
): Sketch {
  const geometry = sketch.geometry.map((entity) => {
    if (entity.id !== entityId || entity.type !== "line") {
      return entity;
    }
    return {
      ...entity,
      start: { x: start.x, y: start.y },
      end: { x: end.x, y: end.y },
    } satisfies LineGeometry;
  });

  return {
    ...sketch,
    geometry,
  };
}

function findGeometry(
  sketch: Sketch,
  entityId: EntityId,
): Geometry | undefined {
  return sketch.geometry.find((entity) => entity.id === entityId);
}

/** Move a point / circle center / arc center (inferred from entity type at apply time). */
export function createMovePointCommand(
  entityId: EntityId,
  from: Point2D,
  to: Point2D,
): SketchCommand | null {
  if (pointsApproximatelyEqual(from, to)) {
    return null;
  }

  return {
    label: `Move ${entityId}`,
    apply(sketch) {
      return moveDraggableInSketch(sketch, entityId, to);
    },
    undo(sketch) {
      return moveDraggableInSketch(sketch, entityId, from);
    },
  };
}
