import {
  distance,
  pointsApproximatelyEqual,
  projectPointOntoLine,
  TOLERANCE,
} from "../geometry/GeometryMath.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import type { Constraint, ConstraintReference } from "../model/Constraint.ts";
import type { Sketch } from "../model/Sketch.ts";
import {
  isLineObjectReference,
  isPointLikeReference,
  normalizePointLikeRef,
  resolveConstraintPoint,
  resolveLineObjectSegment,
  sameConstraintRef,
} from "./ConstraintRef.ts";
import { isDatumOriginId } from "../model/SketchFrame.ts";
import { buildHandleClusters, type HandleClusters } from "./HandleClusters.ts";
import { setPointHandle, setPointHandleWithCluster } from "./PointHandles.ts";

export type CoincidentKind = "point-point" | "point-line";

export interface ClassifiedCoincident {
  readonly kind: CoincidentKind;
  readonly pointA: ConstraintReference;
  readonly pointB?: ConstraintReference;
  readonly line?: ConstraintReference;
}

export interface PositionAnchor {
  readonly ref: ConstraintReference;
  readonly position: Point2D;
}

/**
 * Classify a coincident constraint as point–point or point–line.
 * Returns null when references are not a supported coincident pattern.
 */
export function classifyCoincident(
  sketch: Sketch,
  constraint: Constraint,
): ClassifiedCoincident | null {
  if (constraint.type !== "coincident" || constraint.references.length !== 2) {
    return null;
  }

  const [rawA, rawB] = constraint.references;
  if (rawA === undefined || rawB === undefined) {
    return null;
  }

  const aPoint = isPointLikeReference(sketch, rawA)
    ? normalizePointLikeRef(sketch, rawA)
    : null;
  const bPoint = isPointLikeReference(sketch, rawB)
    ? normalizePointLikeRef(sketch, rawB)
    : null;
  const aLine = isLineObjectReference(sketch, rawA) ? rawA : null;
  const bLine = isLineObjectReference(sketch, rawB) ? rawB : null;

  if (aPoint !== null && bPoint !== null) {
    if (sameConstraintRef(aPoint, bPoint)) {
      return null;
    }
    return { kind: "point-point", pointA: aPoint, pointB: bPoint };
  }

  if (aPoint !== null && bLine !== null) {
    return { kind: "point-line", pointA: aPoint, line: bLine };
  }
  if (bPoint !== null && aLine !== null) {
    return { kind: "point-line", pointA: bPoint, line: aLine };
  }

  return null;
}

/** Normalized handle pairs of every point–point coincident in the sketch. */
export function coincidentPointPairs(
  sketch: Sketch,
): [ConstraintReference, ConstraintReference][] {
  const pairs: [ConstraintReference, ConstraintReference][] = [];
  for (const constraint of sketch.constraints) {
    const classified = classifyCoincident(sketch, constraint);
    if (classified?.kind === "point-point" && classified.pointB !== undefined) {
      pairs.push([classified.pointA, classified.pointB]);
    }
  }
  return pairs;
}

export function buildCoincidentClusters(sketch: Sketch): HandleClusters {
  return buildHandleClusters(coincidentPointPairs(sketch));
}

/** Scalar residual magnitude for one coincident constraint (mm). */
export function coincidentResidual(
  sketch: Sketch,
  constraint: Constraint,
): number | null {
  const classified = classifyCoincident(sketch, constraint);
  if (classified === null) {
    return null;
  }

  if (classified.kind === "point-point") {
    const a = resolveConstraintPoint(sketch, classified.pointA);
    const b = resolveConstraintPoint(sketch, classified.pointB!);
    if (a === null || b === null) {
      return null;
    }
    return distance(a, b);
  }

  const point = resolveConstraintPoint(sketch, classified.pointA);
  const segment = resolveLineObjectSegment(sketch, classified.line!);
  if (point === null || segment === null) {
    return null;
  }
  const projected = projectPointOntoLine(point, segment.start, segment.end);
  return distance(point, projected);
}

export function allCoincidentSatisfied(
  sketch: Sketch,
  tolerance: number = TOLERANCE.coincidence,
): boolean {
  for (const constraint of sketch.constraints) {
    if (constraint.type !== "coincident") {
      continue;
    }
    const residual = coincidentResidual(sketch, constraint);
    if (residual === null || residual > tolerance) {
      return false;
    }
  }
  return true;
}

/**
 * Provisional coincident maintenance (not a full numerical solver).
 * Propagates anchor positions through point–point clusters, then projects
 * point–line coincidents onto their lines.
 */
export function enforceCoincidentConstraints(
  sketch: Sketch,
  anchors: readonly PositionAnchor[] = [],
): Sketch {
  const normalizedAnchors = anchors.map((anchor) => ({
    ref: normalizePointLikeRef(sketch, anchor.ref),
    position: anchor.position,
  }));

  const clusters = buildCoincidentClusters(sketch);
  const next = enforcePointPointClusters(sketch, clusters, normalizedAnchors);
  return enforcePointLineConstraints(next, clusters);
}

function enforcePointPointClusters(
  sketch: Sketch,
  clusters: HandleClusters,
  anchors: readonly PositionAnchor[],
): Sketch {
  if (clusters.clusteredRefs.length === 0) {
    return sketch;
  }

  const clusteredRoots = new Set(
    clusters.clusteredRefs.map((ref) => clusters.rootOf(ref)),
  );
  const targetByRoot = new Map<string, Point2D>();
  for (const anchor of anchors) {
    const root = clusters.rootOf(anchor.ref);
    if (clusteredRoots.has(root)) {
      targetByRoot.set(root, anchor.position);
    }
  }

  // Clusters without an explicit anchor keep the position of the first member.
  for (const ref of clusters.clusteredRefs) {
    const root = clusters.rootOf(ref);
    if (targetByRoot.has(root)) {
      continue;
    }
    const position = resolveConstraintPoint(sketch, ref);
    if (position !== null) {
      targetByRoot.set(root, position);
    }
  }

  let next = sketch;
  for (const ref of clusters.clusteredRefs) {
    // Frame origin is immutable — never write into a datum handle.
    if (isDatumOriginId(next.frame, ref.entityId)) {
      continue;
    }
    const target = targetByRoot.get(clusters.rootOf(ref));
    if (target === undefined) {
      continue;
    }
    const current = resolveConstraintPoint(next, ref);
    if (current !== null && pointsApproximatelyEqual(current, target, TOLERANCE.coincidence)) {
      continue;
    }
    next = setPointHandle(next, ref, target);
  }

  return next;
}

function enforcePointLineConstraints(
  sketch: Sketch,
  clusters: HandleClusters,
): Sketch {
  let next = sketch;
  let changed = true;
  let guard = 0;

  while (changed && guard < 8) {
    changed = false;
    guard += 1;

    for (const constraint of next.constraints) {
      const classified = classifyCoincident(next, constraint);
      if (classified?.kind !== "point-line" || classified.line === undefined) {
        continue;
      }
      const point = resolveConstraintPoint(next, classified.pointA);
      const segment = resolveLineObjectSegment(next, classified.line);
      if (point === null || segment === null) {
        continue;
      }
      if (isDatumOriginId(next.frame, classified.pointA.entityId)) {
        continue;
      }
      const projected = projectPointOntoLine(
        point,
        segment.start,
        segment.end,
      );
      if (pointsApproximatelyEqual(point, projected, TOLERANCE.coincidence)) {
        continue;
      }
      const updated = setPointHandleWithCluster(
        next,
        clusters,
        classified.pointA,
        projected,
      );
      if (updated !== next) {
        next = updated;
        changed = true;
      }
    }
  }

  return next;
}
