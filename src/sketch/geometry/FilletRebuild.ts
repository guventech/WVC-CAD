import {
  listUnsatisfiedConstraints,
  maintainConstraints,
} from "../constraints/ConstraintMaintenance.ts";
import { isDrivingConstraint } from "../model/Constraint.ts";
import type { EntityId, LineGeometry } from "../model/Geometry.ts";
import type { FilletFeatureIds } from "../model/FilletChamferFeature.ts";
import type { Sketch } from "../model/Sketch.ts";
import type { Point2D } from "./Point2D.ts";
import { distance, TOLERANCE } from "./GeometryMath.ts";
import { directionIntoLineFromCorner } from "./FilletChamferMath.ts";
import { intersectInfiniteLines } from "./Intersections.ts";
import {
  cornerFeaturesTopologyIntact,
  findArc,
  findLine,
  finalize,
  rebuildAllCornerFeatures,
  rebuildFilletGeometry,
  syncFilletRadiusConstraints,
  translateCornerFeaturesTouching,
  translateLineInSketch,
  type FilletOutcome,
} from "./FilletChamferOpsShared.ts";
import {
  applyLengthToFilletedEdge,
  restoreUnsatisfiedFilletedLengths,
} from "./FilletLengthRestore.ts";

export {
  filletWedgePickPoint,
  rebuildFilletGeometry,
} from "./FilletChamferOpsShared.ts";

/**
 * Grow/shrink a fillet radius while preserving driving lengths on the parent
 * edges. Translates each parent along the other edge's outward normal by
 * ΔR so the far ends stay attached and remaining length stays L after re-trim.
 */
export function rebuildFilletGeometryPreservingLengths(
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
  if (hit === null) {
    return null;
  }
  const into1 = directionIntoLineFromCorner(line1, hit.point);
  const into2 = directionIntoLineFromCorner(line2, hit.point);
  if (into1 === null || into2 === null) {
    return null;
  }

  const delta = radiusMm - feature.radiusMm;
  let next: Sketch = sketch;
  if (Math.abs(delta) > TOLERANCE.coincidence) {
    const offset1 = { x: -into2.x * delta, y: -into2.y * delta };
    const offset2 = { x: -into1.x * delta, y: -into1.y * delta };
    const moved1 = translateLineInSketch(next, feature.line1Id, offset1);
    if (moved1 === null) {
      return null;
    }
    next = translateCornerFeaturesTouching(moved1, feature.line1Id, offset1);
    const moved2 = translateLineInSketch(next, feature.line2Id, offset2);
    if (moved2 === null) {
      return null;
    }
    next = translateCornerFeaturesTouching(moved2, feature.line2Id, offset2);
  }

  return rebuildFilletGeometry(next, feature, radiusMm);
}

/**
 * After growing/shrinking filleted parents, reconnect free edges that still
 * have coincident constraints to those parents (e.g. rectangle BR/TL corners)
 * by moving only the free edge endpoint onto the parent endpoint.
 */
function closeFreeCornersTouchingFilletParents(
  sketch: Sketch,
  feature: FilletFeatureIds,
): Sketch {
  const parentIds = new Set([feature.line1Id, feature.line2Id]);
  let geometry = sketch.geometry;

  for (const constraint of sketch.constraints) {
    if (constraint.type !== "coincident" || constraint.references.length < 2) {
      continue;
    }
    const first = constraint.references[0]!;
    const second = constraint.references[1]!;
    const firstIsParent = parentIds.has(first.entityId);
    const secondIsParent = parentIds.has(second.entityId);
    if (firstIsParent === secondIsParent) {
      continue;
    }
    const parentRef = firstIsParent ? first : second;
    const freeRef = firstIsParent ? second : first;
    if (
      (parentRef.role !== "start" && parentRef.role !== "end") ||
      (freeRef.role !== "start" && freeRef.role !== "end")
    ) {
      continue;
    }
    const parentLine = findLine({ ...sketch, geometry }, parentRef.entityId);
    const freeLine = findLine({ ...sketch, geometry }, freeRef.entityId);
    if (parentLine === null || freeLine === null) {
      continue;
    }
    const target =
      parentRef.role === "start"
        ? { ...parentLine.start }
        : { ...parentLine.end };
    const updated: LineGeometry =
      freeRef.role === "start"
        ? { ...freeLine, start: target }
        : { ...freeLine, end: target };
    geometry = geometry.map((entity) =>
      entity.id === updated.id ? updated : entity,
    );
  }

  return { ...sketch, geometry };
}

function filletRadiusMatches(
  sketch: Sketch,
  feature: FilletFeatureIds,
  radiusMm: number,
): boolean {
  const arc = findArc(sketch, feature.arcId);
  return (
    arc !== null &&
    Math.abs(arc.radius - radiusMm) <= TOLERANCE.coincidence * 100
  );
}

function filletEditSettled(
  sketch: Sketch,
  feature: FilletFeatureIds,
  radiusMm: number,
): boolean {
  return (
    listUnsatisfiedConstraints(sketch).length === 0 &&
    cornerFeaturesTopologyIntact(sketch) &&
    filletRadiusMatches(sketch, feature, radiusMm)
  );
}

/**
 * Apply a driving fillet radius change and settle constraints without leaving
 * length dims on the parent edges unsatisfied.
 *
 * Changing one fillet translates/trims its parents, which tears sibling
 * fillets or chamfers on those edges — re-seat corner features when needed.
 * When Length dims sit on the filleted edges, also reconnect free corners
 * (rectangle BR/TL) before solving so coincidences can close without tearing
 * the blend.
 */
export function applyFilletRadiusEdit(
  sketch: Sketch,
  feature: FilletFeatureIds,
  radiusMm: number,
): Sketch | null {
  let next = rebuildFilletGeometryPreservingLengths(sketch, feature, radiusMm);
  if (next === null) {
    return null;
  }

  // Restore driving lengths on parents (rebuild can shorten remaining spans).
  for (const lineId of [feature.line1Id, feature.line2Id]) {
    const lengthConstraint = next.constraints.find(
      (constraint) =>
        constraint.type === "length" &&
        isDrivingConstraint(constraint) &&
        constraint.value !== undefined &&
        constraint.references.some((ref) => ref.entityId === lineId),
    );
    if (lengthConstraint?.value === undefined) {
      continue;
    }
    const restored = applyLengthToFilletedEdge(
      next,
      lineId,
      lengthConstraint.value,
    );
    if (restored === null) {
      return null;
    }
    next = restored;
  }

  next = closeFreeCornersTouchingFilletParents(next, feature);
  next = syncFilletRadiusConstraints(next, feature, radiusMm);

  // If the sketch already closes with intact topology, do not rebuildAll —
  // a further trim would shorten Length-driven parents again.
  const direct = maintainConstraints(next, []);
  if (direct.satisfied && filletEditSettled(direct.sketch, feature, radiusMm)) {
    return syncFilletRadiusConstraints(direct.sketch, feature, radiusMm);
  }

  const settleOnce = (candidate: Sketch): Sketch | null => {
    let working = closeFreeCornersTouchingFilletParents(candidate, feature);
    working = restoreUnsatisfiedFilletedLengths(working);
    working = closeFreeCornersTouchingFilletParents(working, feature);
    const maintained = maintainConstraints(working, []);
    if (!maintained.satisfied) {
      return null;
    }
    if (filletEditSettled(maintained.sketch, feature, radiusMm)) {
      return syncFilletRadiusConstraints(maintained.sketch, feature, radiusMm);
    }
    working = rebuildAllCornerFeatures(maintained.sketch);
    const forced = rebuildFilletGeometry(working, feature, radiusMm);
    if (forced === null) {
      return null;
    }
    working = rebuildAllCornerFeatures(forced);
    working = syncFilletRadiusConstraints(working, feature, radiusMm);
    working = restoreUnsatisfiedFilletedLengths(working);
    working = closeFreeCornersTouchingFilletParents(working, feature);
    const again = maintainConstraints(working, []);
    if (!again.satisfied) {
      return null;
    }
    if (filletEditSettled(again.sketch, feature, radiusMm)) {
      return syncFilletRadiusConstraints(again.sketch, feature, radiusMm);
    }
    return again.sketch;
  };

  // Prefer pinning the edited corner so adjacent free edges move with ΔR.
  const anchors = filletTopologyAnchors(next, feature);
  const anchoredMaintain = maintainConstraints(next, anchors);
  if (anchoredMaintain.satisfied) {
    if (filletEditSettled(anchoredMaintain.sketch, feature, radiusMm)) {
      return syncFilletRadiusConstraints(
        anchoredMaintain.sketch,
        feature,
        radiusMm,
      );
    }
    const settled = settleOnce(anchoredMaintain.sketch);
    if (settled !== null && filletEditSettled(settled, feature, radiusMm)) {
      return settled;
    }
  }

  for (let pass = 0; pass < 4; pass++) {
    const settled = settleOnce(next);
    if (settled === null) {
      return null;
    }
    next = settled;
    if (filletEditSettled(next, feature, radiusMm)) {
      return next;
    }
  }

  return null;
}

/** Pin fillet arc center + parent near-ends so maintain moves adjacent edges. */
function filletTopologyAnchors(
  sketch: Sketch,
  feature: FilletFeatureIds,
): readonly {
  readonly ref: {
    readonly entityId: EntityId;
    readonly role: "start" | "end" | "center";
  };
  readonly position: Point2D;
}[] {
  const line1 = findLine(sketch, feature.line1Id);
  const line2 = findLine(sketch, feature.line2Id);
  const arc = findArc(sketch, feature.arcId);
  if (line1 === null || line2 === null || arc === null) {
    return [];
  }
  const hit = intersectInfiniteLines(
    line1.start,
    line1.end,
    line2.start,
    line2.end,
    TOLERANCE.coincidence,
  );
  const corner = hit?.point ?? arc.center;
  const nearRole = (line: LineGeometry): "start" | "end" =>
    distance(line.start, corner) <= distance(line.end, corner)
      ? "start"
      : "end";
  const role1 = nearRole(line1);
  const role2 = nearRole(line2);
  return [
    {
      ref: { entityId: feature.line1Id, role: role1 },
      position: role1 === "start" ? { ...line1.start } : { ...line1.end },
    },
    {
      ref: { entityId: feature.line2Id, role: role2 },
      position: role2 === "start" ? { ...line2.start } : { ...line2.end },
    },
    {
      ref: { entityId: feature.arcId, role: "center" },
      position: { ...arc.center },
    },
  ];
}

/**
 * Rebuild a fillet feature for a new radius, keeping line/arc ids.
 * Uses the current arc center as the corner-wedge pick so topology stays put.
 */
export function updateFilletRadius(
  sketch: Sketch,
  feature: FilletFeatureIds,
  radiusMm: number,
): FilletOutcome {
  const rebuilt = rebuildFilletGeometry(sketch, feature, radiusMm);
  if (rebuilt === null) {
    return { ok: false, reason: "Fillet cannot use that radius" };
  }
  return finalize(rebuilt);
}
