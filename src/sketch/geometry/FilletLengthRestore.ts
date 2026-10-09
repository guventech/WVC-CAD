import { listUnsatisfiedConstraints } from "../constraints/ConstraintMaintenance.ts";
import { isDrivingConstraint } from "../model/Constraint.ts";
import type { EntityId, LineGeometry } from "../model/Geometry.ts";
import { listFilletFeaturesForEntity } from "../model/FilletChamferFeature.ts";
import {
  findRectangleFeatureForEntity,
  type RectangleFeatureIds,
} from "../model/RectangleFeature.ts";
import {
  findFrameAxis,
  isDatumOriginId,
} from "../model/SketchFrame.ts";
import type { Sketch } from "../model/Sketch.ts";
import type { Point2D } from "./Point2D.ts";
import { distance, TOLERANCE } from "./GeometryMath.ts";
import { intersectInfiniteLines } from "./Intersections.ts";
import {
  applyLineTrim,
  findLine,
  rebuildAllCornerFeatures,
  translateCornerFeaturesTouching,
  translateLineInSketch,
} from "./FilletChamferOpsShared.ts";

/**
 * Change the remaining straight length of a filleted edge by shifting the
 * partner edge at one end, then rebuilding blends. Naive solve+trim would put
 * length back to (corner separation − radii) and leave the dimension unsatisfied.
 */
export function applyLengthToFilletedEdge(
  sketch: Sketch,
  lineId: EntityId,
  targetLengthMm: number,
): Sketch | null {
  if (!(targetLengthMm > TOLERANCE.coincidence)) {
    return null;
  }
  const line = findLine(sketch, lineId);
  if (line === null) {
    return null;
  }
  const fillets = listFilletFeaturesForEntity(sketch.constraints, lineId);
  if (fillets.length === 0) {
    return null;
  }

  const current = distance(line.start, line.end);
  if (current <= TOLERANCE.coincidence) {
    return null;
  }
  const delta = targetLengthMm - current;
  if (Math.abs(delta) <= TOLERANCE.coincidence) {
    return rebuildAllCornerFeatures(sketch);
  }

  const u = {
    x: (line.end.x - line.start.x) / current,
    y: (line.end.y - line.start.y) / current,
  };

  // Shift the partner line at the end farther along the edge direction.
  let bestPartnerId: EntityId | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const feature of fillets) {
    const otherId =
      feature.line1Id === lineId ? feature.line2Id : feature.line1Id;
    const other = findLine(sketch, otherId);
    if (other === null) {
      continue;
    }
    const mid = {
      x: (other.start.x + other.end.x) / 2,
      y: (other.start.y + other.end.y) / 2,
    };
    const score =
      (mid.x - line.start.x) * u.x + (mid.y - line.start.y) * u.y;
    if (score > bestScore) {
      bestScore = score;
      bestPartnerId = otherId;
    }
  }
  if (bestPartnerId === null) {
    return null;
  }

  const offset = { x: u.x * delta, y: u.y * delta };
  const shifted = translateLineInSketch(sketch, bestPartnerId, offset);
  if (shifted === null) {
    return null;
  }
  // Keep blend arcs/chamfers on the moved partner so rebuild picks the same
  // interior wedge (stale centers sit on the exterior after a large shift).
  const withBlends = translateCornerFeaturesTouching(
    shifted,
    bestPartnerId,
    offset,
  );
  // Pre-place every edge that meets the moved partner onto its partner
  // tangent points so opposite sides (e.g. left vs length-driven right) cannot
  // keep a stale far endpoint past the new partner.
  let next = withBlends;
  const driven = fitFilletedEdgeBetweenPartners(next, lineId, targetLengthMm);
  if (driven !== null) {
    next = driven;
  }
  for (const feature of listFilletFeaturesForEntity(
    next.constraints,
    bestPartnerId,
  )) {
    const edgeId =
      feature.line1Id === bestPartnerId ? feature.line2Id : feature.line1Id;
    if (edgeId === lineId) {
      continue;
    }
    const snapped = snapFilletedEdgeToPartnerTangents(next, edgeId);
    if (snapped !== null) {
      next = snapped;
    }
  }
  return rebuildAllCornerFeatures(next);
}

/**
 * For each unsatisfied driving length on a filleted line, shift a partner edge
 * so a subsequent rebuild yields the constrained remaining length.
 *
 * Skip restore when the line belongs to an **axis-located** rectangle (edge
 * coordinates or remaining corner↔datum pins). Partner-shove was a primary
 * cause of fillet-after-create drift (sketch-13). Free filleted rectangles and
 * non-rectangle lines still restore segment length.
 */
export function restoreUnsatisfiedFilletedLengths(sketch: Sketch): Sketch {
  let next = sketch;
  const unsatisfied = new Set(listUnsatisfiedConstraints(next));
  for (const constraint of next.constraints) {
    if (
      constraint.type !== "length" ||
      !isDrivingConstraint(constraint) ||
      constraint.value === undefined ||
      !unsatisfied.has(constraint.id)
    ) {
      continue;
    }
    const lineId = constraint.references[0]?.entityId;
    if (lineId === undefined) {
      continue;
    }
    if (listFilletFeaturesForEntity(next.constraints, lineId).length === 0) {
      continue;
    }
    const feature = findRectangleFeatureForEntity(next.constraints, lineId);
    if (feature !== null && rectangleHasAxisLocate(next, feature)) {
      continue;
    }
    const restored = applyLengthToFilletedEdge(next, lineId, constraint.value);
    if (restored !== null) {
      next = restored;
    }
  }
  return next;
}

function rectangleHasAxisLocate(
  sketch: Sketch,
  feature: RectangleFeatureIds,
): boolean {
  const edgeIds = new Set([
    feature.edges.bottom,
    feature.edges.right,
    feature.edges.top,
    feature.edges.left,
  ]);
  const cornerIds = new Set(
    [feature.corners.bl, feature.corners.br, feature.corners.tr, feature.corners.tl].filter(
      (id): id is EntityId => id !== null,
    ),
  );
  for (const constraint of sketch.constraints) {
    if (
      (constraint.type === "coordinate-x" || constraint.type === "coordinate-y") &&
      isDrivingConstraint(constraint) &&
      constraint.references[0] !== undefined &&
      edgeIds.has(constraint.references[0].entityId)
    ) {
      return true;
    }
    if (constraint.type !== "coincident") {
      continue;
    }
    const touchesCorner = constraint.references.some((ref) =>
      cornerIds.has(ref.entityId),
    );
    const touchesEdge = constraint.references.some((ref) =>
      edgeIds.has(ref.entityId),
    );
    if (!touchesCorner && !touchesEdge) {
      continue;
    }
    for (const ref of constraint.references) {
      if (isDatumOriginId(sketch.frame, ref.entityId)) {
        return true;
      }
      if (findFrameAxis(sketch.frame, ref.entityId) !== null) {
        return true;
      }
    }
  }
  return false;
}
/**
 * Place a filleted edge onto the tangent points implied by its end fillets and
 * current partner lines. When `targetLengthMm` is set, the span is scaled to
 * that length about the midpoint if the natural tangent span disagrees.
 */
function fitFilletedEdgeBetweenPartners(
  sketch: Sketch,
  lineId: EntityId,
  targetLengthMm?: number,
): Sketch | null {
  const line = findLine(sketch, lineId);
  if (line === null) {
    return null;
  }
  const fillets = listFilletFeaturesForEntity(sketch.constraints, lineId);
  if (fillets.length === 0) {
    return null;
  }

  const axisLen = distance(line.start, line.end);
  if (!(axisLen > TOLERANCE.coincidence)) {
    return null;
  }
  const axis = {
    x: (line.end.x - line.start.x) / axisLen,
    y: (line.end.y - line.start.y) / axisLen,
  };

  type Corner = {
    readonly feature: (typeof fillets)[number];
    readonly partner: LineGeometry;
    readonly corner: Point2D;
    readonly along: number;
  };
  const corners: Corner[] = [];
  for (const feature of fillets) {
    const partnerId =
      feature.line1Id === lineId ? feature.line2Id : feature.line1Id;
    const partner = findLine(sketch, partnerId);
    if (partner === null) {
      continue;
    }
    const hit = intersectInfiniteLines(
      line.start,
      line.end,
      partner.start,
      partner.end,
      TOLERANCE.coincidence,
    );
    if (hit === null) {
      continue;
    }
    const along =
      (hit.point.x - line.start.x) * axis.x +
      (hit.point.y - line.start.y) * axis.y;
    corners.push({ feature, partner, corner: hit.point, along });
  }
  if (corners.length === 0) {
    return null;
  }
  corners.sort((a, b) => a.along - b.along);

  type EndFit = { readonly along: number; readonly point: Point2D };
  const ends: EndFit[] = [];

  for (let i = 0; i < corners.length; i++) {
    const current = corners[i]!;
    let into = { x: 0, y: 0 };
    if (corners.length >= 2) {
      const other = i === 0 ? corners[corners.length - 1]! : corners[0]!;
      into = {
        x: other.corner.x - current.corner.x,
        y: other.corner.y - current.corner.y,
      };
    } else {
      const midPt = {
        x: (line.start.x + line.end.x) / 2,
        y: (line.start.y + line.end.y) / 2,
      };
      into = {
        x: midPt.x - current.corner.x,
        y: midPt.y - current.corner.y,
      };
    }
    const intoLen = Math.hypot(into.x, into.y);
    if (!(intoLen > TOLERANCE.coincidence)) {
      continue;
    }
    const uEdge = { x: into.x / intoLen, y: into.y / intoLen };

    const partnerMid = {
      x: (current.partner.start.x + current.partner.end.x) / 2,
      y: (current.partner.start.y + current.partner.end.y) / 2,
    };
    const intoPartner = {
      x: partnerMid.x - current.corner.x,
      y: partnerMid.y - current.corner.y,
    };
    const partnerLen = Math.hypot(intoPartner.x, intoPartner.y);
    if (!(partnerLen > TOLERANCE.coincidence)) {
      continue;
    }
    const uPartner = {
      x: intoPartner.x / partnerLen,
      y: intoPartner.y / partnerLen,
    };

    const cosTheta = Math.max(
      -1,
      Math.min(1, uEdge.x * uPartner.x + uEdge.y * uPartner.y),
    );
    const theta = Math.acos(cosTheta);
    if (theta <= TOLERANCE.geometric || theta >= Math.PI - TOLERANCE.geometric) {
      continue;
    }
    const tangentDist = current.feature.radiusMm / Math.tan(theta / 2);
    const tangent = {
      x: current.corner.x + uEdge.x * tangentDist,
      y: current.corner.y + uEdge.y * tangentDist,
    };
    const along =
      (tangent.x - line.start.x) * axis.x +
      (tangent.y - line.start.y) * axis.y;
    ends.push({ along, point: tangent });
  }

  if (ends.length < 1) {
    return null;
  }

  ends.sort((a, b) => a.along - b.along);
  let startPt: Point2D;
  let endPt: Point2D;
  if (ends.length === 1) {
    const only = ends[0]!;
    const length =
      targetLengthMm !== undefined && targetLengthMm > TOLERANCE.coincidence
        ? targetLengthMm
        : Math.max(axisLen, TOLERANCE.coincidence);
    const startAlong = 0;
    const endAlong = axisLen;
    if (Math.abs(only.along - startAlong) <= Math.abs(only.along - endAlong)) {
      startPt = only.point;
      endPt = {
        x: only.point.x + axis.x * length,
        y: only.point.y + axis.y * length,
      };
    } else {
      endPt = only.point;
      startPt = {
        x: only.point.x - axis.x * length,
        y: only.point.y - axis.y * length,
      };
    }
  } else {
    const a = ends[0]!;
    const b = ends[ends.length - 1]!;
    const span = b.along - a.along;
    if (span <= TOLERANCE.coincidence) {
      return null;
    }
    if (
      targetLengthMm === undefined ||
      Math.abs(span - targetLengthMm) <= TOLERANCE.coincidence
    ) {
      startPt = a.point;
      endPt = b.point;
    } else {
      const midAlong = (a.along + b.along) / 2;
      const half = targetLengthMm / 2;
      startPt = {
        x: line.start.x + axis.x * (midAlong - half),
        y: line.start.y + axis.y * (midAlong - half),
      };
      endPt = {
        x: line.start.x + axis.x * (midAlong + half),
        y: line.start.y + axis.y * (midAlong + half),
      };
    }
  }

  // Preserve original start/end orientation along the axis.
  const fittedStartAlong =
    (startPt.x - line.start.x) * axis.x + (startPt.y - line.start.y) * axis.y;
  const fittedEndAlong =
    (endPt.x - line.start.x) * axis.x + (endPt.y - line.start.y) * axis.y;
  if (fittedStartAlong <= fittedEndAlong) {
    return applyLineTrim(sketch, lineId, startPt, endPt);
  }
  return applyLineTrim(sketch, lineId, endPt, startPt);
}

/** Snap a filleted edge to the natural tangent points of its current partners. */
function snapFilletedEdgeToPartnerTangents(
  sketch: Sketch,
  lineId: EntityId,
): Sketch | null {
  return fitFilletedEdgeBetweenPartners(sketch, lineId);
}
