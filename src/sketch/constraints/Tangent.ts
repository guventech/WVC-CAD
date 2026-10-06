import type { Constraint, ConstraintReference } from "../model/Constraint.ts";
import type { CircleGeometry, ArcGeometry } from "../model/Geometry.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import { distance, TOLERANCE } from "../geometry/GeometryMath.ts";
import type { Sketch } from "../model/Sketch.ts";
import {
  findEntity,
  isLineObjectReference,
  resolveLineObjectSegment,
} from "./ConstraintRef.ts";

export type TangentPair =
  | {
      readonly kind: "line-curve";
      readonly line: ConstraintReference;
      readonly curve: ConstraintReference;
    }
  | {
      readonly kind: "curve-curve";
      readonly first: ConstraintReference;
      readonly second: ConstraintReference;
    };

export type TangentCircleMode = "external" | "internal";

type CurveEntity = CircleGeometry | ArcGeometry;

/**
 * Classify two references as line↔circle/arc or circle/arc↔circle/arc.
 * World axes count as lines. Order is normalized (line first when mixed).
 */
export function classifyTangentPair(
  sketch: Sketch,
  references: readonly ConstraintReference[],
): TangentPair | null {
  if (references.length !== 2) {
    return null;
  }
  const [rawA, rawB] = references;
  if (rawA === undefined || rawB === undefined || rawA.entityId === rawB.entityId) {
    return null;
  }

  const aLine = isLineObjectReference(sketch, rawA);
  const bLine = isLineObjectReference(sketch, rawB);
  const aCurve = resolveCurve(sketch, rawA);
  const bCurve = resolveCurve(sketch, rawB);

  if (aLine && bCurve !== null) {
    return {
      kind: "line-curve",
      line: { entityId: rawA.entityId, role: "entity" },
      curve: { entityId: rawB.entityId, role: "entity" },
    };
  }
  if (bLine && aCurve !== null) {
    return {
      kind: "line-curve",
      line: { entityId: rawB.entityId, role: "entity" },
      curve: { entityId: rawA.entityId, role: "entity" },
    };
  }
  if (aCurve !== null && bCurve !== null) {
    return {
      kind: "curve-curve",
      first: { entityId: rawA.entityId, role: "entity" },
      second: { entityId: rawB.entityId, role: "entity" },
    };
  }
  return null;
}

/** Capture which side of the line the curve center sits on (±1). */
export function captureTangentLineSide(
  sketch: Sketch,
  constraint: Constraint,
): 1 | -1 | null {
  if (constraint.type !== "tangent") {
    return null;
  }
  const pair = classifyTangentPair(sketch, constraint.references);
  if (pair?.kind !== "line-curve") {
    return null;
  }
  const signed = signedDistanceToRefLine(sketch, pair.line, pair.curve);
  if (signed === null) {
    return null;
  }
  return signed >= 0 ? 1 : -1;
}

/** Capture external vs internal for circle/arc pairs from current geometry. */
export function captureTangentCircleMode(
  sketch: Sketch,
  constraint: Constraint,
): TangentCircleMode | null {
  if (constraint.type !== "tangent") {
    return null;
  }
  const pair = classifyTangentPair(sketch, constraint.references);
  if (pair?.kind !== "curve-curve") {
    return null;
  }
  const a = resolveCurve(sketch, pair.first);
  const b = resolveCurve(sketch, pair.second);
  if (a === null || b === null) {
    return null;
  }
  const d = distance(a.center, b.center);
  const external = a.radius + b.radius;
  const internal = Math.abs(a.radius - b.radius);
  return Math.abs(d - internal) < Math.abs(d - external) ? "internal" : "external";
}

/** Diagnosis residual (mm). Null when unsupported. */
export function tangentResidual(
  sketch: Sketch,
  constraint: Constraint,
): number | null {
  if (constraint.type !== "tangent") {
    return null;
  }
  const equations = collectTangentResidualEquations(sketch, constraint, {
    lineSide: captureTangentLineSide(sketch, constraint),
    circleMode: captureTangentCircleMode(sketch, constraint),
  });
  if (equations.length === 0) {
    return null;
  }
  return Math.abs(equations[0]!.value);
}

export function collectTangentResidualEquations(
  sketch: Sketch,
  constraint: Constraint,
  options: {
    readonly lineSide: 1 | -1 | null;
    readonly circleMode: TangentCircleMode | null;
  },
): readonly { readonly constraintId: string; readonly value: number }[] {
  if (constraint.type !== "tangent") {
    return [];
  }
  const pair = classifyTangentPair(sketch, constraint.references);
  if (pair === null) {
    return [];
  }

  if (pair.kind === "line-curve") {
    const curve = resolveCurve(sketch, pair.curve);
    const signed = signedDistanceToRefLine(sketch, pair.line, pair.curve);
    if (curve === null || signed === null || curve.radius <= 0) {
      return [];
    }
    const side = options.lineSide ?? (signed >= 0 ? 1 : -1);
    // Tangency uses the supporting circle. Arc sweep membership is not a hard
    // residual (would reject valid line–arc tangents whose contact lies off the
    // drawn sweep); callers/UI should treat that as a known limitation.
    return [
      {
        constraintId: constraint.id,
        value: signed - side * curve.radius,
      },
    ];
  }

  const a = resolveCurve(sketch, pair.first);
  const b = resolveCurve(sketch, pair.second);
  if (a === null || b === null || a.radius <= 0 || b.radius <= 0) {
    return [];
  }
  const d = distance(a.center, b.center);
  const mode =
    options.circleMode ??
    (Math.abs(d - Math.abs(a.radius - b.radius)) <
    Math.abs(d - (a.radius + b.radius))
      ? "internal"
      : "external");
  const target =
    mode === "external" ? a.radius + b.radius : Math.abs(a.radius - b.radius);
  return [
    {
      constraintId: constraint.id,
      value: d - target,
    },
  ];
}

/** Canvas glyph near the approximate contact point. */
export function tangentAnnotationPoint(
  sketch: Sketch,
  constraint: Constraint,
): Point2D | null {
  if (constraint.type !== "tangent") {
    return null;
  }
  const pair = classifyTangentPair(sketch, constraint.references);
  if (pair === null) {
    return null;
  }

  if (pair.kind === "line-curve") {
    const curve = resolveCurve(sketch, pair.curve);
    const segment = resolveLineObjectSegment(sketch, pair.line);
    if (curve === null || segment === null) {
      return null;
    }
    return projectOntoSegment(curve.center, segment.start, segment.end);
  }

  const a = resolveCurve(sketch, pair.first);
  const b = resolveCurve(sketch, pair.second);
  if (a === null || b === null) {
    return null;
  }
  const d = distance(a.center, b.center);
  if (d <= TOLERANCE.geometric) {
    return { x: a.center.x, y: a.center.y };
  }
  const t = a.radius / d;
  return {
    x: a.center.x + (b.center.x - a.center.x) * t,
    y: a.center.y + (b.center.y - a.center.y) * t,
  };
}

function resolveCurve(
  sketch: Sketch,
  ref: ConstraintReference,
): CurveEntity | null {
  const entity = findEntity(sketch, ref.entityId);
  if (entity?.type !== "circle" && entity?.type !== "arc") {
    return null;
  }
  return entity;
}

function signedDistanceToRefLine(
  sketch: Sketch,
  lineRef: ConstraintReference,
  curveRef: ConstraintReference,
): number | null {
  const curve = resolveCurve(sketch, curveRef);
  const segment = resolveLineObjectSegment(sketch, lineRef);
  if (curve === null || segment === null) {
    return null;
  }
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const length = Math.hypot(dx, dy);
  if (length <= TOLERANCE.geometric) {
    return null;
  }
  return (
    ((curve.center.x - segment.start.x) * dy -
      (curve.center.y - segment.start.y) * dx) /
    length
  );
}

function projectOntoSegment(
  point: Point2D,
  start: Point2D,
  end: Point2D,
): Point2D {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= TOLERANCE.geometric * TOLERANCE.geometric) {
    return { x: start.x, y: start.y };
  }
  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq;
  return {
    x: start.x + t * dx,
    y: start.y + t * dy,
  };
}
