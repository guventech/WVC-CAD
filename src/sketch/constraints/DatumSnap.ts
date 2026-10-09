import type { Constraint, ConstraintRole } from "../model/Constraint.ts";
import type { EntityId } from "../model/Geometry.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import {
  pointsApproximatelyEqual,
  TOLERANCE,
} from "../geometry/GeometryMath.ts";
import { createEntityId } from "../model/EntityId.ts";
import type { SketchFrame } from "../model/SketchFrame.ts";
import type { SnapCandidate } from "../selection/SnapTypes.ts";
import {
  createCoincidentConstraint,
  createCoordinateConstraint,
} from "./ConstraintFactory.ts";

/**
 * Creation snap that should become a permanent datum constraint (ADR-050).
 * Origin → point coincident to origin; axis → point on axis (coincident point–line).
 * Prefer coincident / point-on-axis over parallel: rectangle edges already have H/V.
 */
export type DatumSnapBind =
  | { readonly kind: "origin"; readonly originId: EntityId }
  | { readonly kind: "axis"; readonly axisId: EntityId };

export function datumSnapFromCandidate(
  snap: SnapCandidate | null | undefined,
): DatumSnapBind | null {
  if (snap?.sourceEntityId === undefined) {
    return null;
  }
  if (snap.type === "origin") {
    return { kind: "origin", originId: snap.sourceEntityId };
  }
  if (snap.type === "axis") {
    return { kind: "axis", axisId: snap.sourceEntityId };
  }
  return null;
}

/** Build coincident(pointRef, datum) for an origin or axis snap. */
export function createDatumSnapConstraint(
  pointRef: { readonly entityId: EntityId; readonly role: ConstraintRole },
  bind: DatumSnapBind,
  id?: string,
): Constraint {
  const constraintId = id ?? createEntityId("constraint");
  if (bind.kind === "origin") {
    return createCoincidentConstraint(constraintId, pointRef, {
      entityId: bind.originId,
      role: "position",
    });
  }
  return createCoincidentConstraint(constraintId, pointRef, {
    entityId: bind.axisId,
    role: "entity",
  });
}

export type RectCornerPoints = Readonly<
  Record<
    "bl" | "br" | "tr" | "tl",
    { readonly id: EntityId; readonly position: Point2D }
  >
>;

/**
 * Match a world click to the rectangle corner that landed there, then emit a
 * datum coincident when the snap was origin/axis.
 */
export function datumConstraintsForRectangleCorner(
  cornerPoints: RectCornerPoints,
  click: Point2D,
  snap: SnapCandidate | null | undefined,
): Constraint[] {
  const bind = datumSnapFromCandidate(snap);
  if (bind === null) {
    return [];
  }
  const corner = findCornerAtPoint(cornerPoints, click);
  if (corner === null) {
    return [];
  }
  return [
    createDatumSnapConstraint(
      { entityId: corner.id, role: "position" },
      bind,
    ),
  ];
}

export type RectEdgeIds = Readonly<{
  bottom: EntityId;
  right: EntityId;
  top: EntityId;
  left: EntityId;
}>;

/**
 * When an axis-aligned edge lies on a world axis after create, pin corners
 * (origin/axis coincident) and also emit durable edge coordinate locate
 * (coordinate-y=0 on bottom/top, coordinate-x=0 on left/right). Coordinates
 * survive sketch fillets that consume corner points (ADR-051 / sketch-12).
 */
export function datumConstraintsForEdgesOnAxes(
  frame: SketchFrame,
  cornerPoints: RectCornerPoints,
  edges?: RectEdgeIds,
): Constraint[] {
  const out: Constraint[] = [];
  const xAxis = frame.axes.find((axis) => axis.tag === "x");
  const yAxis = frame.axes.find((axis) => axis.tag === "y");

  const pinCornerToAxis = (
    corner: { readonly id: EntityId; readonly position: Point2D },
    axisId: EntityId,
  ): void => {
    if (isAtOrigin(corner.position)) {
      out.push(
        createDatumSnapConstraint(
          { entityId: corner.id, role: "position" },
          { kind: "origin", originId: frame.originId },
        ),
      );
      return;
    }
    out.push(
      createDatumSnapConstraint(
        { entityId: corner.id, role: "position" },
        { kind: "axis", axisId },
      ),
    );
  };

  if (
    xAxis !== undefined &&
    isOnXAxis(cornerPoints.bl.position) &&
    isOnXAxis(cornerPoints.br.position)
  ) {
    pinCornerToAxis(cornerPoints.bl, xAxis.id);
    pinCornerToAxis(cornerPoints.br, xAxis.id);
    if (edges !== undefined) {
      out.push(
        createCoordinateConstraint(
          createEntityId("constraint"),
          "coordinate-y",
          edges.bottom,
          0,
          { role: "start", driving: true },
        ),
      );
    }
  }
  if (
    xAxis !== undefined &&
    isOnXAxis(cornerPoints.tl.position) &&
    isOnXAxis(cornerPoints.tr.position)
  ) {
    pinCornerToAxis(cornerPoints.tl, xAxis.id);
    pinCornerToAxis(cornerPoints.tr, xAxis.id);
    if (edges !== undefined) {
      out.push(
        createCoordinateConstraint(
          createEntityId("constraint"),
          "coordinate-y",
          edges.top,
          0,
          { role: "start", driving: true },
        ),
      );
    }
  }
  if (
    yAxis !== undefined &&
    isOnYAxis(cornerPoints.bl.position) &&
    isOnYAxis(cornerPoints.tl.position)
  ) {
    pinCornerToAxis(cornerPoints.bl, yAxis.id);
    pinCornerToAxis(cornerPoints.tl, yAxis.id);
    if (edges !== undefined) {
      out.push(
        createCoordinateConstraint(
          createEntityId("constraint"),
          "coordinate-x",
          edges.left,
          0,
          { role: "start", driving: true },
        ),
      );
    }
  }
  if (
    yAxis !== undefined &&
    isOnYAxis(cornerPoints.br.position) &&
    isOnYAxis(cornerPoints.tr.position)
  ) {
    pinCornerToAxis(cornerPoints.br, yAxis.id);
    pinCornerToAxis(cornerPoints.tr, yAxis.id);
    if (edges !== undefined) {
      out.push(
        createCoordinateConstraint(
          createEntityId("constraint"),
          "coordinate-x",
          edges.right,
          0,
          { role: "start", driving: true },
        ),
      );
    }
  }

  return dedupeDatumConstraints(out);
}

function isOnXAxis(p: Point2D): boolean {
  return Math.abs(p.y) <= TOLERANCE.coincidence;
}

function isOnYAxis(p: Point2D): boolean {
  return Math.abs(p.x) <= TOLERANCE.coincidence;
}

function isAtOrigin(p: Point2D): boolean {
  return pointsApproximatelyEqual(p, { x: 0, y: 0 }, TOLERANCE.coincidence);
}

function findCornerAtPoint(
  cornerPoints: RectCornerPoints,
  click: Point2D,
): { readonly id: EntityId; readonly position: Point2D } | null {
  for (const key of ["bl", "br", "tr", "tl"] as const) {
    const corner = cornerPoints[key];
    if (
      pointsApproximatelyEqual(corner.position, click, TOLERANCE.coincidence)
    ) {
      return corner;
    }
  }
  return null;
}

function dedupeDatumConstraints(
  constraints: readonly Constraint[],
): Constraint[] {
  const seen = new Set<string>();
  const out: Constraint[] = [];
  for (const constraint of constraints) {
    const pairKey = constraint.references
      .map((ref) => `${ref.entityId}:${ref.role}`)
      .sort()
      .join("+");
    if (seen.has(pairKey)) {
      continue;
    }
    seen.add(pairKey);
    out.push(constraint);
  }
  return out;
}
