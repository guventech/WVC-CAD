import { maintainConstraints } from "../constraints/ConstraintMaintenance.ts";
import { angleBetweenLines } from "../constraints/Dimensions.ts";
import { createLineGeometry } from "../commands/CreateGeometryCommand.ts";
import { isDrivingConstraint } from "../model/Constraint.ts";
import type { ArcGeometry, EntityId, LineGeometry } from "../model/Geometry.ts";
import {
  dissolveRectangleAtCorner,
  linesShareRectangle,
  promoteFilletedRectangleEdgeLengths,
  promoteRectangleEdgeLengthsToOuterSpans,
} from "../model/RectangleFillet.ts";
import { findRectangleFeatureForEntity } from "../model/RectangleFeature.ts";
import {
  listChamferFeaturesForEntity,
  listFilletFeaturesForEntity,
  parseChamferFeature,
  parseFilletFeature,
  type ChamferFeatureIds,
  type FilletFeatureIds,
} from "../model/FilletChamferFeature.ts";
import type { Sketch } from "../model/Sketch.ts";
import type { Point2D } from "./Point2D.ts";
import {
  closestPointOnSegment,
  distance,
  pointsApproximatelyEqual,
  TOLERANCE,
} from "./GeometryMath.ts";
import {
  chamferDistanceFromPick,
  computeLineLineChamferFromLengthAngle,
  computeLineLineFillet,
  filletRadiusFromPick,
  pickCornerDirections,
  type ChamferGeometryPlan,
  type FilletGeometryPlan,
} from "./FilletChamferMath.ts";
import { intersectInfiniteLines } from "./Intersections.ts";

export const FILLET_RECTANGLE_BLOCKED_REASON =
  "Pick two adjacent edges of the same rectangle corner to fillet.";

export const CHAMFER_RECTANGLE_BLOCKED_REASON =
  "Pick two adjacent edges of the same rectangle corner to chamfer.";

export type FilletChamferFailureReason =
  | typeof FILLET_RECTANGLE_BLOCKED_REASON
  | typeof CHAMFER_RECTANGLE_BLOCKED_REASON
  | "Lines must be different"
  | "Lines are not valid for fillet"
  | "Lines are not valid for chamfer"
  | "Fillet cannot use that radius"
  | "Chamfer cannot use that length or angle"
  | "Constraints would become unsatisfied";

export type FilletOutcome =
  | { readonly ok: true; readonly sketch: Sketch }
  | { readonly ok: false; readonly reason: FilletChamferFailureReason };

export type ChamferOutcome =
  | { readonly ok: true; readonly sketch: Sketch }
  | { readonly ok: false; readonly reason: FilletChamferFailureReason };

export function findLine(sketch: Sketch, entityId: EntityId): LineGeometry | null {
  const entity = sketch.geometry.find((item) => item.id === entityId);
  if (entity === undefined || entity.type !== "line") {
    return null;
  }
  return entity;
}

export function nearerEndpointRole(
  line: LineGeometry,
  point: Point2D,
): "start" | "end" {
  return distance(line.start, point) <= distance(line.end, point)
    ? "start"
    : "end";
}

export function findArc(sketch: Sketch, entityId: EntityId): ArcGeometry | null {
  const entity = sketch.geometry.find((item) => item.id === entityId);
  if (entity === undefined || entity.type !== "arc") {
    return null;
  }
  return entity;
}

export function prepareRectangleCorner(
  sketch: Sketch,
  line1Id: EntityId,
  line2Id: EntityId,
  notAdjacentReason: typeof FILLET_RECTANGLE_BLOCKED_REASON | typeof CHAMFER_RECTANGLE_BLOCKED_REASON,
): { readonly ok: true; readonly sketch: Sketch } | { readonly ok: false; readonly reason: FilletChamferFailureReason } {
  const feature1 = findRectangleFeatureForEntity(sketch.constraints, line1Id);
  const feature2 = findRectangleFeatureForEntity(sketch.constraints, line2Id);

  // Mixing a rectangle edge with a free line is not supported.
  if (feature1 !== null && feature2 === null) {
    return { ok: false, reason: notAdjacentReason };
  }
  if (feature2 !== null && feature1 === null) {
    return { ok: false, reason: notAdjacentReason };
  }
  if (feature1 !== null && feature2 !== null) {
    if (feature1.constraintId !== feature2.constraintId) {
      return { ok: false, reason: notAdjacentReason };
    }
    if (!linesShareRectangle(sketch, line1Id, line2Id)) {
      return { ok: false, reason: notAdjacentReason };
    }
  }
  return { ok: true, sketch };
}

export function finalizeAfterCornerEdit(
  sketch: Sketch,
  line1Id: EntityId,
  line2Id: EntityId,
  cornerPoint?: Point2D,
): FilletOutcome {
  // Clear meeting coincident (+ open that corner on the rectangle feature).
  const dissolved = dissolveRectangleAtCorner(
    sketch,
    line1Id,
    line2Id,
    cornerPoint,
  );
  const feature = findRectangleFeatureForEntity(
    dissolved.constraints,
    line1Id,
  );
  // Rectangle edge lengths were overall size (100×100). After trim they fight
  // the fillet and shove axis-locked sides — promote to opposite-edge spans.
  // Promote every filleted edge on the feature (not only this corner) so a
  // second fillet cannot leave a stale segment length on a prior edge.
  // Non-rectangle parents: retarget length to the remaining segment.
  const sized =
    feature !== null
      ? promoteFilletedRectangleEdgeLengths(
          promoteRectangleEdgeLengthsToOuterSpans(dissolved, [
            line1Id,
            line2Id,
          ]),
        )
      : retargetDrivingLengthsOnLines(dissolved, [line1Id, line2Id]);
  return finalize(sized);
}

/** Set driving length constraints on these lines to their current segment length. */
export function retargetDrivingLengthsOnLines(
  sketch: Sketch,
  lineIds: readonly EntityId[],
): Sketch {
  const targets = new Set(lineIds);
  let changed = false;
  const constraints = sketch.constraints.map((constraint) => {
    if (
      constraint.type !== "length" ||
      !isDrivingConstraint(constraint) ||
      constraint.references[0] === undefined ||
      !targets.has(constraint.references[0].entityId)
    ) {
      return constraint;
    }
    const line = findLine(sketch, constraint.references[0].entityId);
    if (line === null) {
      return constraint;
    }
    const measured = distance(line.start, line.end);
    if (
      constraint.value !== undefined &&
      Math.abs(constraint.value - measured) <= TOLERANCE.coincidence
    ) {
      return constraint;
    }
    changed = true;
    return { ...constraint, value: measured };
  });
  return changed ? { ...sketch, constraints } : sketch;
}

export function blockRectangle(
  sketch: Sketch,
  id1: EntityId,
  id2: EntityId,
  reason: typeof FILLET_RECTANGLE_BLOCKED_REASON | typeof CHAMFER_RECTANGLE_BLOCKED_REASON,
): FilletChamferFailureReason | null {
  const prepared = prepareRectangleCorner(sketch, id1, id2, reason);
  if (!prepared.ok) {
    return prepared.reason;
  }
  return null;
}

export function applyLineTrim(
  sketch: Sketch,
  entityId: EntityId,
  start: Point2D,
  end: Point2D,
): Sketch | null {
  if (distance(start, end) <= TOLERANCE.coincidence) {
    return null;
  }
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
  return { ...sketch, geometry };
}

export function replaceOrAppendArc(sketch: Sketch, arc: ArcGeometry): Sketch {
  const exists = sketch.geometry.some((entity) => entity.id === arc.id);
  if (!exists) {
    return { ...sketch, geometry: [...sketch.geometry, arc] };
  }
  return {
    ...sketch,
    geometry: sketch.geometry.map((entity) =>
      entity.id === arc.id ? arc : entity,
    ),
  };
}

export function applyFilletPlan(
  sketch: Sketch,
  line1Id: EntityId,
  line2Id: EntityId,
  plan: FilletGeometryPlan,
): Sketch | null {
  let next = applyLineTrim(
    sketch,
    line1Id,
    plan.line1Trim.start,
    plan.line1Trim.end,
  );
  if (next === null) {
    return null;
  }
  next = applyLineTrim(
    next,
    line2Id,
    plan.line2Trim.start,
    plan.line2Trim.end,
  );
  if (next === null) {
    return null;
  }
  return replaceOrAppendArc(next, plan.arc);
}

export function applyChamferPlan(
  sketch: Sketch,
  line1Id: EntityId,
  line2Id: EntityId,
  plan: ChamferGeometryPlan,
): Sketch | null {
  let next = applyLineTrim(
    sketch,
    line1Id,
    plan.line1Trim.start,
    plan.line1Trim.end,
  );
  if (next === null) {
    return null;
  }
  next = applyLineTrim(
    next,
    line2Id,
    plan.line2Trim.start,
    plan.line2Trim.end,
  );
  if (next === null) {
    return null;
  }
  const chamferLine = createLineGeometry(
    plan.chamferLine.start,
    plan.chamferLine.end,
    {
      construction:
        findLine(sketch, line1Id)?.construction ||
        findLine(sketch, line2Id)?.construction ||
        false,
    },
  );
  if (chamferLine === null) {
    return null;
  }
  return {
    ...next,
    geometry: [...next.geometry, chamferLine],
  };
}

export function finalize(sketch: Sketch): FilletOutcome {
  // Defense in depth: outer-span promote before LM (also done in finalizeAfterCornerEdit).
  let working = promoteFilletedRectangleEdgeLengths(sketch);
  const maintained = maintainConstraints(working);
  if (!maintained.satisfied) {
    return { ok: false, reason: "Constraints would become unsatisfied" };
  }
  working = promoteFilletedRectangleEdgeLengths(maintained.sketch);
  if (working.constraints !== maintained.sketch.constraints) {
    const again = maintainConstraints(working);
    if (!again.satisfied) {
      return { ok: false, reason: "Constraints would become unsatisfied" };
    }
    return { ok: true, sketch: again.sketch };
  }
  return { ok: true, sketch: maintained.sketch };
}

export function resolveFilletRadius(
  line1: LineGeometry,
  line2: LineGeometry,
  pickPoint: Point2D,
  radius: number | undefined,
): number {
  if (radius !== undefined) {
    return radius;
  }
  const hit = intersectInfiniteLines(
    line1.start,
    line1.end,
    line2.start,
    line2.end,
    TOLERANCE.coincidence,
  );
  if (hit === null) {
    return filletRadiusFromPick(pickPoint, pickPoint);
  }
  return filletRadiusFromPick(hit.point, pickPoint);
}

export function resolveChamferDistance(
  line1: LineGeometry,
  line2: LineGeometry,
  pickPoint: Point2D,
  chamferDistance: number | undefined,
): number {
  if (chamferDistance !== undefined) {
    return chamferDistance;
  }
  const hit = intersectInfiniteLines(
    line1.start,
    line1.end,
    line2.start,
    line2.end,
    TOLERANCE.coincidence,
  );
  if (hit === null) {
    return chamferDistanceFromPick(pickPoint, pickPoint);
  }
  return chamferDistanceFromPick(hit.point, pickPoint);
}

/**
 * Prefer the wedge along the finite segment bodies (inner corner) when the
 * cursor lies in the exterior wedge — size still comes from `pickPoint`.
 */
export function resolveCornerWedgePickPoint(
  line1: LineGeometry,
  line2: LineGeometry,
  pickPoint: Point2D,
): Point2D {
  const bodyPick = filletWedgePickPoint(line1, line2);
  if (bodyPick === null) {
    return pickPoint;
  }
  const hit = intersectInfiniteLines(
    line1.start,
    line1.end,
    line2.start,
    line2.end,
    TOLERANCE.coincidence,
  );
  if (hit === null) {
    return pickPoint;
  }
  const cursorDirs = pickCornerDirections(line1, line2, hit.point, pickPoint);
  if (cursorDirs !== null) {
    return pickPoint;
  }
  return bodyPick;
}

export function syncFilletRadiusConstraints(
  sketch: Sketch,
  feature: FilletFeatureIds,
  radiusMm: number,
): Sketch {
  const constraints = sketch.constraints.map((constraint) => {
    if (constraint.id === feature.constraintId) {
      return { ...constraint, value: radiusMm };
    }
    if (
      constraint.type === "radius" &&
      constraint.references.some((ref) => ref.entityId === feature.arcId)
    ) {
      return { ...constraint, value: radiusMm };
    }
    if (
      constraint.type === "diameter" &&
      constraint.references.some((ref) => ref.entityId === feature.arcId)
    ) {
      return { ...constraint, value: radiusMm * 2 };
    }
    return constraint;
  });
  return { ...sketch, constraints };
}
export function translateLineInSketch(
  sketch: Sketch,
  lineId: EntityId,
  offset: Point2D,
): Sketch | null {
  const line = findLine(sketch, lineId);
  if (line === null) {
    return null;
  }
  const updated: LineGeometry = {
    ...line,
    start: { x: line.start.x + offset.x, y: line.start.y + offset.y },
    end: { x: line.end.x + offset.x, y: line.end.y + offset.y },
  };
  return {
    ...sketch,
    geometry: sketch.geometry.map((entity) =>
      entity.id === lineId ? updated : entity,
    ),
  };
}
export function orientChamferToReference(
  chamfer: { readonly start: Point2D; readonly end: Point2D },
  reference: LineGeometry,
): { readonly start: Point2D; readonly end: Point2D } {
  const asIs: LineGeometry = {
    id: "tmp-chamfer",
    type: "line",
    start: chamfer.start,
    end: chamfer.end,
    construction: false,
  };
  const flipped: LineGeometry = {
    ...asIs,
    start: chamfer.end,
    end: chamfer.start,
  };
  const a1 = angleBetweenLines(reference, asIs);
  const a2 = angleBetweenLines(reference, flipped);
  return a1 <= a2
    ? { start: chamfer.start, end: chamfer.end }
    : { start: chamfer.end, end: chamfer.start };
}

/**
 * Pick a point inside the corner wedge from the remaining line segments
 * (average of far endpoints from the intersection). Robust after line moves.
 */
/**
 * Pick a point inside the corner wedge for fillet/chamfer orientation.
 * Walks from the intersection toward the longer arm of each segment, then
 * averages — this stays in the interior even when one parent still extends
 * past the opposite edge (far-endpoint / midpoint averaging can sit on a
 * boundary and match the exterior wedge too).
 */
export function filletWedgePickPoint(
  line1: LineGeometry,
  line2: LineGeometry,
): Point2D | null {
  const hit = intersectInfiniteLines(
    line1.start,
    line1.end,
    line2.start,
    line2.end,
    TOLERANCE.coincidence,
  );
  if (hit === null) {
    return null;
  }
  const intoSegment = (line: LineGeometry): Point2D | null => {
    const toStart = {
      x: line.start.x - hit.point.x,
      y: line.start.y - hit.point.y,
    };
    const toEnd = {
      x: line.end.x - hit.point.x,
      y: line.end.y - hit.point.y,
    };
    const dStart = Math.hypot(toStart.x, toStart.y);
    const dEnd = Math.hypot(toEnd.x, toEnd.y);
    if (dStart >= dEnd && dStart > TOLERANCE.coincidence) {
      return {
        x: hit.point.x + toStart.x * 0.5,
        y: hit.point.y + toStart.y * 0.5,
      };
    }
    if (dEnd > TOLERANCE.coincidence) {
      return {
        x: hit.point.x + toEnd.x * 0.5,
        y: hit.point.y + toEnd.y * 0.5,
      };
    }
    return null;
  };
  const a = intoSegment(line1);
  const b = intoSegment(line2);
  if (a === null || b === null) {
    return null;
  }
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

/**
 * Rebuild fillet line trims + arc for a radius (same entity ids).
 * Does not run the solver — callers maintain constraints afterwards.
 */
export function rebuildFilletGeometry(
  sketch: Sketch,
  feature: FilletFeatureIds,
  radiusMm: number,
): Sketch | null {
  const line1 = findLine(sketch, feature.line1Id);
  const line2 = findLine(sketch, feature.line2Id);
  const arc = findArc(sketch, feature.arcId);
  if (line1 === null || line2 === null || arc === null) {
    return null;
  }

  const hit = intersectInfiniteLines(
    line1.start,
    line1.end,
    line2.start,
    line2.end,
    TOLERANCE.coincidence,
  );
  const primaryPick = filletWedgePickPoint(line1, line2) ?? arc.center;
  const picks: Point2D[] = [primaryPick];
  // Large parent moves can flip the exterior wedge; retry the opposite branch
  // (ADR-052 fillet sign/branch retry) before giving up.
  if (hit !== null) {
    picks.push({
      x: 2 * hit.point.x - primaryPick.x,
      y: 2 * hit.point.y - primaryPick.y,
    });
    if (
      Math.hypot(arc.center.x - primaryPick.x, arc.center.y - primaryPick.y) >
      TOLERANCE.coincidence
    ) {
      picks.push(arc.center);
    }
  }

  for (const pickPoint of picks) {
    const plan = computeLineLineFillet(line1, line2, radiusMm, pickPoint, {
      arcId: arc.id,
      construction: arc.construction,
    });
    if (plan === null) {
      continue;
    }
    const mutated = applyFilletPlan(sketch, feature.line1Id, feature.line2Id, plan);
    if (mutated === null) {
      continue;
    }
    return syncFilletRadiusConstraints(mutated, feature, radiusMm);
  }
  return null;
}

/**
 * Grow/shrink a fillet radius while preserving driving lengths on the parent
 * edges. Translates each parent along the other edge's outward normal by
 * ΔR so the far ends stay attached and remaining length stays L after re-trim.
 */

export function syncChamferDriveConstraints(
  sketch: Sketch,
  feature: ChamferFeatureIds,
  lengthMm: number,
  angleRad: number,
): Sketch {
  const constraints = sketch.constraints.map((constraint) => {
    if (constraint.id === feature.constraintId) {
      return { ...constraint, value: lengthMm };
    }
    if (
      constraint.type === "length" &&
      constraint.references.some((ref) => ref.entityId === feature.chamferLineId)
    ) {
      return { ...constraint, value: lengthMm };
    }
    if (
      constraint.type === "angle" &&
      constraint.references.some((ref) => ref.entityId === feature.chamferLineId)
    ) {
      return { ...constraint, value: angleRad };
    }
    return constraint;
  });
  return { ...sketch, constraints };
}

/** Angle constraint that pairs the chamfer segment with a parent line. */
export function findChamferAngleConstraint(
  sketch: Sketch,
  feature: ChamferFeatureIds,
): { readonly constraintId: string; readonly referenceLineId: EntityId } | null {
  for (const constraint of sketch.constraints) {
    if (constraint.type !== "angle" || constraint.references.length < 2) {
      continue;
    }
    const ids = constraint.references.map((ref) => ref.entityId);
    if (!ids.includes(feature.chamferLineId)) {
      continue;
    }
    if (ids.includes(feature.line1Id)) {
      return { constraintId: constraint.id, referenceLineId: feature.line1Id };
    }
    if (ids.includes(feature.line2Id)) {
      return { constraintId: constraint.id, referenceLineId: feature.line2Id };
    }
  }
  return null;
}

export function resolveChamferAngleRad(
  sketch: Sketch,
  feature: ChamferFeatureIds,
  chamferLine: LineGeometry,
  referenceLineId: EntityId,
): number {
  const angleConstraint = findChamferAngleConstraint(sketch, feature);
  if (angleConstraint !== null) {
    const live = sketch.constraints.find((c) => c.id === angleConstraint.constraintId);
    if (live?.value !== undefined) {
      return live.value;
    }
  }
  const reference = findLine(sketch, referenceLineId);
  if (reference === null) {
    return Math.PI / 4;
  }
  return angleBetweenLines(reference, chamferLine);
}

/**
 * Prefer chamfer endpoint order so the angle vs reference is the smaller one
 * in [0, π] (e.g. 45° rather than 135° on a square corner).
 */
export function rebuildChamferGeometry(
  sketch: Sketch,
  feature: ChamferFeatureIds,
  lengthMm: number,
  angleRad?: number,
): Sketch | null {
  const line1 = findLine(sketch, feature.line1Id);
  const line2 = findLine(sketch, feature.line2Id);
  const chamferLine = findLine(sketch, feature.chamferLineId);
  if (line1 === null || line2 === null || chamferLine === null) {
    return null;
  }

  const pickPoint = filletWedgePickPoint(line1, line2);
  if (pickPoint === null) {
    return null;
  }

  const angleInfo = findChamferAngleConstraint(sketch, feature);
  const referenceLineId = angleInfo?.referenceLineId ?? feature.line1Id;
  const reference: "first" | "second" =
    referenceLineId === feature.line2Id ? "second" : "first";
  const resolvedAngle =
    angleRad ?? resolveChamferAngleRad(sketch, feature, chamferLine, referenceLineId);

  const plan = computeLineLineChamferFromLengthAngle(
    line1,
    line2,
    lengthMm,
    resolvedAngle,
    pickPoint,
    reference,
  );
  if (plan === null) {
    return null;
  }

  let next = applyLineTrim(
    sketch,
    feature.line1Id,
    plan.line1Trim.start,
    plan.line1Trim.end,
  );
  if (next === null) {
    return null;
  }
  next = applyLineTrim(
    next,
    feature.line2Id,
    plan.line2Trim.start,
    plan.line2Trim.end,
  );
  if (next === null) {
    return null;
  }

  const referenceLine = reference === "first" ? line1 : line2;
  const oriented = orientChamferToReference(plan.chamferLine, referenceLine);
  const updatedChamfer: LineGeometry = {
    ...chamferLine,
    start: { x: oriented.start.x, y: oriented.start.y },
    end: { x: oriented.end.x, y: oriented.end.y },
  };
  next = {
    ...next,
    geometry: next.geometry.map((entity) =>
      entity.id === feature.chamferLineId ? updatedChamfer : entity,
    ),
  };
  const measuredAngle = angleBetweenLines(referenceLine, updatedChamfer);
  return syncChamferDriveConstraints(next, feature, lengthMm, measuredAngle);
}
/**
 * After a line/arc that belongs to fillet/chamfer features moves, rebuild every
 * connected blend so endpoints stay joined.
 */
export function rebuildCornerFeaturesTouching(
  sketch: Sketch,
  entityId: EntityId,
): Sketch {
  let next = sketch;

  for (const feature of listFilletFeaturesForEntity(next.constraints, entityId)) {
    // Re-parse radius from live constraint in case it was edited.
    const live = next.constraints.find((c) => c.id === feature.constraintId);
    const parsed = live !== undefined ? parseFilletFeature(live) : feature;
    const radius = parsed?.radiusMm ?? feature.radiusMm;
    const rebuilt = rebuildFilletGeometry(next, feature, radius);
    if (rebuilt !== null) {
      next = rebuilt;
    }
  }

  for (const feature of listChamferFeaturesForEntity(next.constraints, entityId)) {
    const live = next.constraints.find((c) => c.id === feature.constraintId);
    const parsed = live !== undefined ? parseChamferFeature(live) : feature;
    const lengthMm = parsed?.lengthMm ?? feature.lengthMm;
    const rebuilt = rebuildChamferGeometry(next, feature, lengthMm);
    if (rebuilt !== null) {
      next = rebuilt;
    }
  }

  return next;
}

/**
 * Rebuild every fillet/chamfer in the sketch. Use after the solver may have
 * moved lines independently of blend arcs (constrained drag / dimension edit).
 */
export function rebuildAllCornerFeatures(sketch: Sketch): Sketch {
  let next = sketch;
  const seen = new Set<string>();

  for (const constraint of sketch.constraints) {
    const fillet = parseFilletFeature(constraint);
    if (fillet !== null) {
      if (seen.has(fillet.constraintId)) {
        continue;
      }
      seen.add(fillet.constraintId);
      const live = next.constraints.find((c) => c.id === fillet.constraintId);
      const parsed = live !== undefined ? parseFilletFeature(live) : fillet;
      const radius = parsed?.radiusMm ?? fillet.radiusMm;
      const rebuilt = rebuildFilletGeometry(next, fillet, radius);
      if (rebuilt !== null) {
        next = rebuilt;
      }
      continue;
    }

    const chamfer = parseChamferFeature(constraint);
    if (chamfer === null || seen.has(chamfer.constraintId)) {
      continue;
    }
    seen.add(chamfer.constraintId);
    const live = next.constraints.find((c) => c.id === chamfer.constraintId);
    const parsed = live !== undefined ? parseChamferFeature(live) : chamfer;
    const lengthMm = parsed?.lengthMm ?? chamfer.lengthMm;
    const rebuilt = rebuildChamferGeometry(next, chamfer, lengthMm);
    if (rebuilt !== null) {
      next = rebuilt;
    }
  }

  return next;
}
export function arcEndpoint(
  arc: ArcGeometry,
  which: "start" | "end",
): Point2D {
  const angle = which === "start" ? arc.startAngle : arc.endAngle;
  return {
    x: arc.center.x + arc.radius * Math.cos(angle),
    y: arc.center.y + arc.radius * Math.sin(angle),
  };
}

export function lineTouchesPoint(line: LineGeometry, point: Point2D): boolean {
  const tol = TOLERANCE.coincidence * 10;
  if (
    pointsApproximatelyEqual(line.start, point, tol) ||
    pointsApproximatelyEqual(line.end, point, tol)
  ) {
    return true;
  }
  const onSegment = closestPointOnSegment(point, line.start, line.end);
  return pointsApproximatelyEqual(point, onSegment, tol);
}

/**
 * True when every fillet arc endpoint touches its two parent lines and every
 * chamfer segment endpoint touches its parents. Used to reject drags that
 * would commit a torn blend topology.
 */
export function cornerFeaturesTopologyIntact(sketch: Sketch): boolean {
  for (const constraint of sketch.constraints) {
    const fillet = parseFilletFeature(constraint);
    if (fillet !== null) {
      const line1 = findLine(sketch, fillet.line1Id);
      const line2 = findLine(sketch, fillet.line2Id);
      const arc = findArc(sketch, fillet.arcId);
      if (line1 === null || line2 === null || arc === null) {
        return false;
      }
      const start = arcEndpoint(arc, "start");
      const end = arcEndpoint(arc, "end");
      const startOk =
        (lineTouchesPoint(line1, start) && lineTouchesPoint(line2, end)) ||
        (lineTouchesPoint(line2, start) && lineTouchesPoint(line1, end));
      if (!startOk) {
        return false;
      }
      continue;
    }

    const chamfer = parseChamferFeature(constraint);
    if (chamfer === null) {
      continue;
    }
    const line1 = findLine(sketch, chamfer.line1Id);
    const line2 = findLine(sketch, chamfer.line2Id);
    const bevel = findLine(sketch, chamfer.chamferLineId);
    if (line1 === null || line2 === null || bevel === null) {
      return false;
    }
    const startOk =
      (lineTouchesPoint(line1, bevel.start) && lineTouchesPoint(line2, bevel.end)) ||
      (lineTouchesPoint(line2, bevel.start) && lineTouchesPoint(line1, bevel.end));
    if (!startOk) {
      return false;
    }
  }
  return true;
}
/** Translate fillet arcs / chamfer segments that reference `entityId`. */
export function translateCornerFeaturesTouching(
  sketch: Sketch,
  entityId: EntityId,
  offset: Point2D,
): Sketch {
  const moveIds = new Set<EntityId>();
  for (const feature of listFilletFeaturesForEntity(sketch.constraints, entityId)) {
    moveIds.add(feature.arcId);
  }
  for (const feature of listChamferFeaturesForEntity(
    sketch.constraints,
    entityId,
  )) {
    moveIds.add(feature.chamferLineId);
  }
  if (moveIds.size === 0) {
    return sketch;
  }
  return {
    ...sketch,
    geometry: sketch.geometry.map((entity) => {
      if (!moveIds.has(entity.id)) {
        return entity;
      }
      if (entity.type === "arc") {
        return {
          ...entity,
          center: {
            x: entity.center.x + offset.x,
            y: entity.center.y + offset.y,
          },
        };
      }
      if (entity.type === "line") {
        return {
          ...entity,
          start: {
            x: entity.start.x + offset.x,
            y: entity.start.y + offset.y,
          },
          end: { x: entity.end.x + offset.x, y: entity.end.y + offset.y },
        };
      }
      return entity;
    }),
  };
}
/**
 * After a solve that may have moved filleted parents, rebuild blends and
 * restore any driving lengths the rebuild temporarily broke (same loop as
 * constrained drag). Returns null when topology or constraints cannot settle.
 */