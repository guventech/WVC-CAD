import { maintainConstraints } from "../constraints/ConstraintMaintenance.ts";
import type { EntityId, LineGeometry } from "../model/Geometry.ts";
import { findRectangleFeatureForEntity } from "../model/RectangleFeature.ts";
import {
  resolveFrameAxisLine,
  type SketchFrame,
} from "../model/SketchFrame.ts";
import type { Sketch } from "../model/Sketch.ts";
import { createEntityId } from "../model/EntityId.ts";
import type { Point2D } from "./Point2D.ts";
import {
  distance,
  isApproximatelyEqual,
  TOLERANCE,
} from "./GeometryMath.ts";
import {
  intersectInfiniteLines,
  intersectLineSegments,
  lineParameter,
  pointAtParameter,
} from "./Intersections.ts";

export const TRIM_RECTANGLE_BLOCKED_REASON =
  "Rectangle edges cannot be trimmed; delete the rectangle feature instead.";

export const EXTEND_RECTANGLE_BLOCKED_REASON =
  "Rectangle edges cannot be extended; delete the rectangle feature instead.";

export type TrimExtendFailureReason =
  | typeof TRIM_RECTANGLE_BLOCKED_REASON
  | typeof EXTEND_RECTANGLE_BLOCKED_REASON
  | "No line hit"
  | "No cutting boundary"
  | "Nothing to trim"
  | "Nothing to extend"
  | "Would create zero-length line"
  | "Constraints would become unsatisfied";

export type TrimExtendOutcome =
  | { readonly ok: true; readonly sketch: Sketch }
  | { readonly ok: false; readonly reason: TrimExtendFailureReason };

/**
 * Collect interior cut parameters on `target` from other lines and world axes.
 * Axis cuts use infinite-axis ∩ finite-target (t on target in (0,1)).
 */
export function collectLineCutParameters(
  sketch: Sketch,
  target: LineGeometry,
): number[] {
  const cuts: number[] = [];
  const tolerance = TOLERANCE.coincidence;

  for (const entity of sketch.geometry) {
    if (entity.id === target.id || entity.type !== "line") {
      continue;
    }
    const hit = intersectLineSegments(
      target.start,
      target.end,
      entity.start,
      entity.end,
      tolerance,
    );
    if (hit !== null) {
      cuts.push(hit.tA);
    }
  }

  for (const axis of sketch.frame.axes) {
    const axisLine = resolveFrameAxisLine(sketch.frame, axis.id);
    if (axisLine === null) {
      continue;
    }
    const hit = intersectInfiniteLines(
      target.start,
      target.end,
      axisLine.start,
      axisLine.end,
      tolerance,
    );
    if (hit === null) {
      continue;
    }
    if (hit.tA > tolerance && hit.tA < 1 - tolerance) {
      cuts.push(hit.tA);
    }
  }

  return uniqueSortedParameters(cuts, tolerance);
}

/**
 * Trim the clicked interval of a line between the nearest cut boundaries.
 * End trims keep the same entity id; middle trims split into two new lines
 * and remove the original (constraints that referenced it are dropped).
 */
export function applyTrimLine(
  sketch: Sketch,
  entityId: EntityId,
  clickWorld: Point2D,
): TrimExtendOutcome {
  const target = findLine(sketch, entityId);
  if (target === null) {
    return { ok: false, reason: "No line hit" };
  }
  if (findRectangleFeatureForEntity(sketch.constraints, entityId) !== null) {
    return { ok: false, reason: TRIM_RECTANGLE_BLOCKED_REASON };
  }

  const tClick = lineParameter(clickWorld, target.start, target.end);
  if (tClick === null) {
    return { ok: false, reason: "No line hit" };
  }

  const cuts = collectLineCutParameters(sketch, target);
  if (cuts.length === 0) {
    return { ok: false, reason: "No cutting boundary" };
  }

  const bounds = [0, ...cuts, 1];
  let left = 0;
  let right = 1;
  for (let i = 0; i < bounds.length - 1; i += 1) {
    if (tClick >= bounds[i]! && tClick <= bounds[i + 1]!) {
      left = bounds[i]!;
      right = bounds[i + 1]!;
      break;
    }
  }

  if (isApproximatelyEqual(left, 0) && isApproximatelyEqual(right, 1)) {
    return { ok: false, reason: "Nothing to trim" };
  }

  let next: Sketch;
  if (isApproximatelyEqual(left, 0)) {
    const newStart = pointAtParameter(target.start, target.end, right);
    const shortened = replaceLineEndpoints(sketch, target.id, newStart, target.end);
    if (shortened === null) {
      return { ok: false, reason: "Would create zero-length line" };
    }
    next = shortened;
  } else if (isApproximatelyEqual(right, 1)) {
    const newEnd = pointAtParameter(target.start, target.end, left);
    const shortened = replaceLineEndpoints(sketch, target.id, target.start, newEnd);
    if (shortened === null) {
      return { ok: false, reason: "Would create zero-length line" };
    }
    next = shortened;
  } else {
    const leftEnd = pointAtParameter(target.start, target.end, left);
    const rightStart = pointAtParameter(target.start, target.end, right);
    if (
      distance(target.start, leftEnd) <= TOLERANCE.coincidence ||
      distance(rightStart, target.end) <= TOLERANCE.coincidence
    ) {
      return { ok: false, reason: "Would create zero-length line" };
    }
    next = splitLineRemovingMiddle(sketch, target, leftEnd, rightStart);
  }

  return finalizeWithConstraints(next);
}

/**
 * Extend the nearer endpoint of a line to the nearest boundary along the ray
 * past that end (other lines or world axes).
 */
export function applyExtendLine(
  sketch: Sketch,
  entityId: EntityId,
  clickWorld: Point2D,
): TrimExtendOutcome {
  const target = findLine(sketch, entityId);
  if (target === null) {
    return { ok: false, reason: "No line hit" };
  }
  if (findRectangleFeatureForEntity(sketch.constraints, entityId) !== null) {
    return { ok: false, reason: EXTEND_RECTANGLE_BLOCKED_REASON };
  }

  const tClick = lineParameter(clickWorld, target.start, target.end);
  if (tClick === null) {
    return { ok: false, reason: "No line hit" };
  }

  const extendStart = tClick < 0.5;
  const candidates = collectExtendTargets(sketch, target, extendStart);
  if (candidates.length === 0) {
    return { ok: false, reason: "Nothing to extend" };
  }

  candidates.sort((a, b) => a.distance - b.distance);
  const best = candidates[0]!;
  const shortened = extendStart
    ? replaceLineEndpoints(sketch, target.id, best.point, target.end)
    : replaceLineEndpoints(sketch, target.id, target.start, best.point);

  if (shortened === null) {
    return { ok: false, reason: "Would create zero-length line" };
  }

  return finalizeWithConstraints(shortened);
}

function collectExtendTargets(
  sketch: Sketch,
  target: LineGeometry,
  extendStart: boolean,
): { readonly point: Point2D; readonly distance: number }[] {
  const tolerance = TOLERANCE.coincidence;
  const results: { point: Point2D; distance: number }[] = [];
  const anchor = extendStart ? target.start : target.end;

  const consider = (point: Point2D, tOnTarget: number) => {
    if (extendStart) {
      if (!(tOnTarget < -tolerance)) {
        return;
      }
    } else if (!(tOnTarget > 1 + tolerance)) {
      return;
    }
    const d = distance(anchor, point);
    if (d <= tolerance) {
      return;
    }
    results.push({ point, distance: d });
  };

  for (const entity of sketch.geometry) {
    if (entity.id === target.id || entity.type !== "line") {
      continue;
    }
    const hit = intersectInfiniteLines(
      target.start,
      target.end,
      entity.start,
      entity.end,
      tolerance,
    );
    if (hit === null) {
      continue;
    }
    // Crossing entity must land on the finite cutter segment.
    if (hit.tB < -tolerance || hit.tB > 1 + tolerance) {
      continue;
    }
    consider(hit.point, hit.tA);
  }

  for (const axis of sketch.frame.axes) {
    const axisLine = resolveFrameAxisLine(sketch.frame, axis.id);
    if (axisLine === null) {
      continue;
    }
    const hit = intersectInfiniteLines(
      target.start,
      target.end,
      axisLine.start,
      axisLine.end,
      tolerance,
    );
    if (hit === null) {
      continue;
    }
    consider(hit.point, hit.tA);
  }

  return results;
}

function splitLineRemovingMiddle(
  sketch: Sketch,
  target: LineGeometry,
  leftEnd: Point2D,
  rightStart: Point2D,
): Sketch {
  const leftLine: LineGeometry = {
    id: createEntityId("line"),
    type: "line",
    start: { x: target.start.x, y: target.start.y },
    end: { x: leftEnd.x, y: leftEnd.y },
    construction: target.construction,
  };
  const rightLine: LineGeometry = {
    id: createEntityId("line"),
    type: "line",
    start: { x: rightStart.x, y: rightStart.y },
    end: { x: target.end.x, y: target.end.y },
    construction: target.construction,
  };

  const geometry = sketch.geometry
    .filter((entity) => entity.id !== target.id)
    .concat([leftLine, rightLine]);
  const constraints = sketch.constraints.filter(
    (constraint) =>
      !constraint.references.some((ref) => ref.entityId === target.id),
  );

  return {
    ...sketch,
    geometry,
    constraints,
  };
}

function replaceLineEndpoints(
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

function finalizeWithConstraints(sketch: Sketch): TrimExtendOutcome {
  const maintained = maintainConstraints(sketch);
  if (!maintained.satisfied) {
    return { ok: false, reason: "Constraints would become unsatisfied" };
  }
  return { ok: true, sketch: maintained.sketch };
}

function findLine(sketch: Sketch, entityId: EntityId): LineGeometry | null {
  const entity = sketch.geometry.find((item) => item.id === entityId);
  if (entity === undefined || entity.type !== "line") {
    return null;
  }
  return entity;
}

function uniqueSortedParameters(
  values: readonly number[],
  tolerance: number,
): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const unique: number[] = [];
  for (const value of sorted) {
    const last = unique[unique.length - 1];
    if (last === undefined || Math.abs(value - last) > tolerance) {
      unique.push(value);
    }
  }
  return unique;
}

/** Exported for tests — whether axes participate as cutters. */
export function listAxisCutters(frame: SketchFrame): {
  readonly id: EntityId;
  readonly start: Point2D;
  readonly end: Point2D;
}[] {
  return frame.axes.flatMap((axis) => {
    const line = resolveFrameAxisLine(frame, axis.id);
    if (line === null) {
      return [];
    }
    return [{ id: axis.id, start: line.start, end: line.end }];
  });
}
