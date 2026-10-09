import { classifyCoincident } from "../constraints/Coincident.ts";
import {
  maintainConstraints,
} from "../constraints/ConstraintMaintenance.ts";
import {
  resolveLineObjectSegment,
} from "../constraints/ConstraintRef.ts";
import { entityHasDrivingRadiusDimension } from "../constraints/Dimensions.ts";
import {
  isApproximatelyEqual,
  pointsApproximatelyEqual,
  projectPointOntoLine,
  TOLERANCE,
} from "../geometry/GeometryMath.ts";
import type { ConstraintReference } from "../model/Constraint.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import type { EntityId, Geometry } from "../model/Geometry.ts";
import {
  edgeKeyForLine,
  findRectangleFeatureForEntity,
  readRectangleCorners,
} from "../model/RectangleFeature.ts";
import { isDatumOriginId } from "../model/SketchFrame.ts";
import type { Sketch } from "../model/Sketch.ts";
import type { SketchCommand } from "./Command.ts";
import type { GeometryDragTarget } from "./GeometryDrag.ts";
import { applyGeometryDrag } from "./MovePointCommand.ts";
import { reconcileCornerFeaturesAfterSolve } from "../geometry/FilletChamferOps.ts";

function cornerOrEdgeAnchor(
  cornerId: EntityId | null,
  edgeId: EntityId,
  which: "start" | "end",
  position: Point2D,
): { readonly ref: ConstraintReference; readonly position: Point2D } {
  if (cornerId !== null) {
    return { ref: { entityId: cornerId, role: "position" }, position };
  }
  return { ref: { entityId: edgeId, role: which }, position };
}

/**
 * Apply a Select-tool drag, then solve constraints (coincident, H/V,
 * driving dimensions) via LM (`maintainConstraints`).
 *
 * When the sketch has fillet/chamfer features, a second *geometry re-seating*
 * pass (`reconcileCornerFeaturesAfterSolve`) rebuilds derived blend arcs and
 * restores driving lengths, then re-runs LM. It is not an alternate solver:
 * residual satisfaction remains the acceptance gate. If reconcile returns null,
 * the drag is rejected and `sketch` is unchanged.
 *
 * When the dragged handle cannot be placed without violating a constraint,
 * the drag is rejected and `sketch` is returned.
 */
export function applyGeometryDragWithConstraints(
  sketch: Sketch,
  target: GeometryDragTarget,
  position: Point2D,
): Sketch {
  if (
    (target.kind === "circle-radius" || target.kind === "arc-radius") &&
    entityHasDrivingRadiusDimension(sketch, target.entityId)
  ) {
    return sketch;
  }

  const projected = projectDragPositionOntoDatums(sketch, target, position);
  const moved = applyGeometryDrag(sketch, target, projected);
  if (moved === sketch) {
    return sketch;
  }
  const anchors = anchorsFromDragTarget(moved, target, projected);
  const result = maintainConstraints(moved, anchors);
  if (!result.satisfied || approximatelySameGeometry(sketch, result.sketch)) {
    return sketch;
  }

  const reconciled = reconcileCornerFeaturesAfterSolve(result.sketch);
  if (reconciled === null) {
    return sketch;
  }
  return reconciled;
}

/**
 * When dragging a handle coincident with the origin or a frame axis, project
 * the cursor onto that datum so anchors do not fight the residual.
 */
function projectDragPositionOntoDatums(
  sketch: Sketch,
  target: GeometryDragTarget,
  position: Point2D,
): Point2D {
  const handleRef = dragTargetPointRef(target);
  if (handleRef === null) {
    return position;
  }

  let next = position;
  for (const constraint of sketch.constraints) {
    if (constraint.type !== "coincident") {
      continue;
    }
    const classified = classifyCoincident(sketch, constraint);
    if (classified === null) {
      continue;
    }
    if (
      classified.kind === "point-point" &&
      classified.pointB !== undefined &&
      refsMatchHandle(classified.pointA, handleRef)
    ) {
      if (isDatumOriginId(sketch.frame, classified.pointB.entityId)) {
        return { x: 0, y: 0 };
      }
    }
    if (
      classified.kind === "point-point" &&
      classified.pointB !== undefined &&
      refsMatchHandle(classified.pointB, handleRef)
    ) {
      if (isDatumOriginId(sketch.frame, classified.pointA.entityId)) {
        return { x: 0, y: 0 };
      }
    }
    if (
      classified.kind === "point-line" &&
      classified.line !== undefined &&
      refsMatchHandle(classified.pointA, handleRef)
    ) {
      const segment = resolveLineObjectSegment(sketch, classified.line);
      if (segment !== null) {
        next = projectPointOntoLine(next, segment.start, segment.end);
      }
    }
  }
  return next;
}

function dragTargetPointRef(
  target: GeometryDragTarget,
): ConstraintReference | null {
  switch (target.kind) {
    case "point":
      return { entityId: target.entityId, role: "position" };
    case "circle-center":
    case "arc-center":
      return { entityId: target.entityId, role: "center" };
    case "line-endpoint":
      return { entityId: target.entityId, role: target.which };
    default:
      return null;
  }
}

function refsMatchHandle(
  ref: ConstraintReference,
  handle: ConstraintReference,
): boolean {
  return ref.entityId === handle.entityId && (
    ref.role === handle.role ||
    (handle.role === "position" &&
      (ref.role === "entity" || ref.role === "point" || ref.role === "position"))
  );
}

/** True when geometry matches within coincidence (solver float noise is a no-op). */
function approximatelySameGeometry(a: Sketch, b: Sketch): boolean {
  if (a.geometry.length !== b.geometry.length) {
    return false;
  }
  return a.geometry.every((entity, index) =>
    entitiesApproximatelyEqual(entity, b.geometry[index]!),
  );
}

function entitiesApproximatelyEqual(a: Geometry, b: Geometry): boolean {
  if (a.id !== b.id || a.type !== b.type || a.construction !== b.construction) {
    return false;
  }
  switch (a.type) {
    case "point":
      return b.type === "point" && pointsApproximatelyEqual(a.position, b.position, TOLERANCE.coincidence);
    case "line":
      return (
        b.type === "line" &&
        pointsApproximatelyEqual(a.start, b.start, TOLERANCE.coincidence) &&
        pointsApproximatelyEqual(a.end, b.end, TOLERANCE.coincidence)
      );
    case "circle":
      return (
        b.type === "circle" &&
        pointsApproximatelyEqual(a.center, b.center, TOLERANCE.coincidence) &&
        isApproximatelyEqual(a.radius, b.radius, TOLERANCE.coincidence)
      );
    case "arc":
      return (
        b.type === "arc" &&
        pointsApproximatelyEqual(a.center, b.center, TOLERANCE.coincidence) &&
        isApproximatelyEqual(a.radius, b.radius, TOLERANCE.coincidence) &&
        isApproximatelyEqual(a.startAngle, b.startAngle, TOLERANCE.angular) &&
        isApproximatelyEqual(a.endAngle, b.endAngle, TOLERANCE.angular)
      );
  }
}

/**
 * Build an undoable geometry drag that also maintains constraints.
 * Returns null when `from`/`to` are the same point or the sketch is unchanged.
 * Undo restores the pre-drag geometry (maintenance is not reversible by
 * dragging back, e.g. a length-constrained line rotates).
 */
export function createMoveGeometryCommand(
  sketch: Sketch,
  target: GeometryDragTarget,
  from: Point2D,
  to: Point2D,
): SketchCommand | null {
  if (pointsApproximatelyEqual(from, to)) {
    return null;
  }

  const applied = applyGeometryDragWithConstraints(sketch, target, to);
  if (applied === sketch) {
    return null;
  }
  const previousGeometry = sketch.geometry;

  return {
    label: `Move ${target.entityId}`,
    apply(current) {
      return applyGeometryDragWithConstraints(current, target, to);
    },
    undo(current) {
      return { ...current, geometry: previousGeometry };
    },
  };
}

export function anchorsFromDragTarget(
  sketch: Sketch,
  target: GeometryDragTarget,
  position: Point2D,
): { readonly ref: ConstraintReference; readonly position: Point2D }[] {
  switch (target.kind) {
    case "point":
      return [{ ref: { entityId: target.entityId, role: "position" }, position }];
    case "circle-center":
    case "arc-center":
      return [{ ref: { entityId: target.entityId, role: "center" }, position }];
    case "line-endpoint":
      return [
        {
          ref: { entityId: target.entityId, role: target.which },
          position,
        },
      ];
    case "line-body": {
      const feature = findRectangleFeatureForEntity(
        sketch.constraints,
        target.entityId,
      );
      const edge =
        feature !== null ? edgeKeyForLine(feature, target.entityId) : null;
      if (feature !== null && edge !== null) {
        return anchorsFromDragTarget(
          sketch,
          { kind: "rectangle-edge", entityId: target.entityId, edge },
          position,
        );
      }
      const entity = sketch.geometry.find((item) => item.id === target.entityId);
      if (entity?.type !== "line") {
        return [];
      }
      return [
        {
          ref: { entityId: target.entityId, role: "start" },
          position: entity.start,
        },
        {
          ref: { entityId: target.entityId, role: "end" },
          position: entity.end,
        },
      ];
    }
    case "rectangle-edge": {
      const feature = findRectangleFeatureForEntity(
        sketch.constraints,
        target.entityId,
      );
      if (feature === null) {
        return [];
      }
      const openCorner =
        feature.corners.bl === null ||
        feature.corners.br === null ||
        feature.corners.tr === null ||
        feature.corners.tl === null;
      // After fillets, endpoints sit at tangent points. Pinning them to virtual
      // outer corners fights fillet topology residuals. Pin only the dragged
      // edge at its current trimmed pose; length restore / reconcile may move
      // the opposite edge (e.g. translate when a perpendicular Length is locked).
      if (openCorner) {
        const dragged = sketch.geometry.find((e) => e.id === target.entityId);
        if (dragged?.type !== "line") {
          return [];
        }
        return [
          {
            ref: { entityId: dragged.id, role: "start" },
            position: { ...dragged.start },
          },
          {
            ref: { entityId: dragged.id, role: "end" },
            position: { ...dragged.end },
          },
        ];
      }
      const corners = readRectangleCorners(sketch.geometry, feature);
      if (corners === null) {
        return [];
      }
      return [
        cornerOrEdgeAnchor(
          feature.corners.bl,
          feature.edges.bottom,
          "start",
          corners.bl,
        ),
        cornerOrEdgeAnchor(
          feature.corners.br,
          feature.edges.bottom,
          "end",
          corners.br,
        ),
        cornerOrEdgeAnchor(
          feature.corners.tr,
          feature.edges.right,
          "end",
          corners.tr,
        ),
        cornerOrEdgeAnchor(
          feature.corners.tl,
          feature.edges.left,
          "start",
          corners.tl,
        ),
      ];
    }
    case "circle-radius":
    case "arc-radius":
      return [];
  }
}
