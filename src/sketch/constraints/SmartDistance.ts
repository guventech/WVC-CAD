import { isApproximatelyEqual, TOLERANCE } from "../geometry/GeometryMath.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import type { ConstraintReference } from "../model/Constraint.ts";
import type { LineGeometry } from "../model/Geometry.ts";
import type { Sketch } from "../model/Sketch.ts";
import {
  DATUM_AXIS_X_ID,
  DATUM_AXIS_Y_ID,
  findFrameAxis,
  resolveFrameAxisLine,
} from "../model/SketchFrame.ts";
import { findEntity, resolveConstraintPoint } from "./ConstraintRef.ts";

/** ~2° — treat nearly axis-aligned spans as H/V distance (commercial smart-dim). */
const AXIS_ALIGN_SIN = Math.sin((2 * Math.PI) / 180);

export type PointPairDistanceType =
  | "horizontal-distance"
  | "vertical-distance"
  | "distance";

export type SmartDistanceRequest = {
  readonly type:
    | "length"
    | "distance"
    | "horizontal-distance"
    | "vertical-distance"
    | "coordinate-x"
    | "coordinate-y";
  readonly references: readonly ConstraintReference[];
};

export type DistancePick =
  | { readonly kind: "point-like"; readonly ref: ConstraintReference }
  | { readonly kind: "line"; readonly ref: ConstraintReference };

/**
 * Classify a completed Distance tool selection into a concrete dimension request.
 *
 * - Same line twice → `length`
 * - Two points → H / V / Euclidean by alignment
 * - Point + X-axis (or horizontal edge shorthand) → `coordinate-y`
 * - Point + Y-axis (or vertical edge shorthand) → `coordinate-x`
 * - Two horizontal lines (incl. X-axis) → `vertical-distance` between anchors
 * - Two vertical lines (incl. Y-axis) → `horizontal-distance` between anchors
 * - User line + matching axis → coordinate on the line's start (locate sketch)
 */
export function classifyDistancePicks(
  sketch: Sketch,
  first: DistancePick,
  second: DistancePick,
): SmartDistanceRequest | null {
  if (first.kind === "line" && second.kind === "line") {
    if (first.ref.entityId === second.ref.entityId) {
      if (isWorldAxisId(sketch, first.ref.entityId)) {
        return null;
      }
      return { type: "length", references: [first.ref] };
    }
    return classifyLinePair(sketch, first.ref, second.ref);
  }

  if (first.kind === "point-like" && second.kind === "point-like") {
    return classifyPointPair(sketch, first.ref, second.ref);
  }

  const point = first.kind === "point-like" ? first : second.kind === "point-like" ? second : null;
  const line = first.kind === "line" ? first : second.kind === "line" ? second : null;
  if (point === null || line === null) {
    return null;
  }
  return classifyPointAndLine(sketch, point.ref, line.ref);
}

export function choosePointPairDistanceType(
  dx: number,
  dy: number,
  hyp: number,
): PointPairDistanceType {
  if (dy / hyp <= AXIS_ALIGN_SIN) {
    return "horizontal-distance";
  }
  if (dx / hyp <= AXIS_ALIGN_SIN) {
    return "vertical-distance";
  }
  return "distance";
}

/** @deprecated Use classifyDistancePicks — kept for narrow unit tests. */
export function classifySmartDistance(
  lineRef: ConstraintReference | null,
  pointA: ConstraintReference | null,
  pointB: ConstraintReference | null,
  pointAWorld: Point2D | null,
  pointBWorld: Point2D | null,
):
  | { readonly type: "length"; readonly lineRef: ConstraintReference }
  | {
      readonly type: PointPairDistanceType;
      readonly a: ConstraintReference;
      readonly b: ConstraintReference;
    }
  | null {
  if (lineRef !== null) {
    return { type: "length", lineRef };
  }
  if (
    pointA === null ||
    pointB === null ||
    pointAWorld === null ||
    pointBWorld === null
  ) {
    return null;
  }
  const dx = Math.abs(pointBWorld.x - pointAWorld.x);
  const dy = Math.abs(pointBWorld.y - pointAWorld.y);
  const hyp = Math.hypot(dx, dy);
  if (!(hyp > TOLERANCE.coincidence)) {
    return null;
  }
  const type = choosePointPairDistanceType(dx, dy, hyp);
  return { type, a: pointA, b: pointB };
}

function classifyPointPair(
  sketch: Sketch,
  a: ConstraintReference,
  b: ConstraintReference,
): SmartDistanceRequest | null {
  const aWorld = resolveConstraintPoint(sketch, a);
  const bWorld = resolveConstraintPoint(sketch, b);
  if (aWorld === null || bWorld === null) {
    return null;
  }
  const dx = Math.abs(bWorld.x - aWorld.x);
  const dy = Math.abs(bWorld.y - aWorld.y);
  const hyp = Math.hypot(dx, dy);
  if (!(hyp > TOLERANCE.coincidence)) {
    return null;
  }
  return {
    type: choosePointPairDistanceType(dx, dy, hyp),
    references: [a, b],
  };
}

function classifyPointAndLine(
  sketch: Sketch,
  pointRef: ConstraintReference,
  lineRef: ConstraintReference,
): SmartDistanceRequest | null {
  const axis = findFrameAxis(sketch.frame, lineRef.entityId);
  if (axis !== null) {
    // Distance from point to X-axis → Y offset; to Y-axis → X offset.
    return {
      type: axis.tag === "x" ? "coordinate-y" : "coordinate-x",
      references: [pointRef],
    };
  }
  const line = resolveLine(sketch, lineRef.entityId);
  if (line === null) {
    return null;
  }
  if (isHorizontalLine(line)) {
    return { type: "coordinate-y", references: [pointRef] };
  }
  if (isVerticalLine(line)) {
    return { type: "coordinate-x", references: [pointRef] };
  }
  return null;
}

function classifyLinePair(
  sketch: Sketch,
  aRef: ConstraintReference,
  bRef: ConstraintReference,
): SmartDistanceRequest | null {
  const aAxis = findFrameAxis(sketch.frame, aRef.entityId);
  const bAxis = findFrameAxis(sketch.frame, bRef.entityId);
  if (aAxis !== null && bAxis !== null) {
    return null;
  }

  // User line + world axis → locate via coordinate on the user line.
  if (aAxis !== null || bAxis !== null) {
    const axis = aAxis ?? bAxis!;
    const userRef = aAxis !== null ? bRef : aRef;
    const userLine = resolveLine(sketch, userRef.entityId);
    if (userLine === null) {
      return null;
    }
    if (axis.tag === "x") {
      // Offset from X-axis: prefer horizontal edges (same as former Offset tool).
      if (!isHorizontalLine(userLine) && !isVerticalLine(userLine)) {
        // Still allow: use start Y as coordinate-y (general locate).
      }
      return {
        type: "coordinate-y",
        references: [{ entityId: userRef.entityId, role: "start" }],
      };
    }
    return {
      type: "coordinate-x",
      references: [{ entityId: userRef.entityId, role: "start" }],
    };
  }

  const lineA = resolveLine(sketch, aRef.entityId);
  const lineB = resolveLine(sketch, bRef.entityId);
  if (lineA === null || lineB === null) {
    return null;
  }

  const aH = isHorizontalLine(lineA);
  const bH = isHorizontalLine(lineB);
  const aV = isVerticalLine(lineA);
  const bV = isVerticalLine(lineB);

  if (aH && bH) {
    return {
      type: "vertical-distance",
      references: [
        { entityId: aRef.entityId, role: "start" },
        { entityId: bRef.entityId, role: "start" },
      ],
    };
  }
  if (aV && bV) {
    return {
      type: "horizontal-distance",
      references: [
        { entityId: aRef.entityId, role: "start" },
        { entityId: bRef.entityId, role: "start" },
      ],
    };
  }
  return null;
}

function resolveLine(sketch: Sketch, entityId: string): LineGeometry | null {
  const axisLine = resolveFrameAxisLine(sketch.frame, entityId);
  if (axisLine !== null) {
    return {
      id: entityId,
      type: "line",
      start: axisLine.start,
      end: axisLine.end,
      construction: true,
    };
  }
  const entity = findEntity(sketch, entityId);
  return entity?.type === "line" ? entity : null;
}

function isHorizontalLine(line: LineGeometry): boolean {
  return isApproximatelyEqual(line.start.y, line.end.y, TOLERANCE.coincidence);
}

function isVerticalLine(line: LineGeometry): boolean {
  return isApproximatelyEqual(line.start.x, line.end.x, TOLERANCE.coincidence);
}

function isWorldAxisId(sketch: Sketch, entityId: string): boolean {
  return (
    entityId === DATUM_AXIS_X_ID ||
    entityId === DATUM_AXIS_Y_ID ||
    findFrameAxis(sketch.frame, entityId) !== null
  );
}
