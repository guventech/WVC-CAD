import {
  classifyCoincident,
  coincidentResidual,
} from "../constraints/Coincident.ts";
import {
  findEntity,
  resolveConstraintPoint,
  resolveLineObjectSegment,
} from "../constraints/ConstraintRef.ts";
import type { ConstraintReference } from "../model/Constraint.ts";
import {
  dimensionResidual,
  dimensionTolerance,
  distanceHandles,
  isSupportedDimensionType,
  referencedLine,
  resolveCoordinatePoint,
  signedAngleBetweenLines,
} from "../constraints/Dimensions.ts";
import {
  isOrientationType,
  orientationHandles,
  orientationResidual,
} from "../constraints/Orientation.ts";
import {
  collectLineRelationResidualEquations,
  isLineRelationType,
  lineRelationResidual,
} from "../constraints/Parallel.ts";
import {
  captureTangentCircleMode,
  captureTangentLineSide,
  collectTangentResidualEquations,
  tangentResidual,
  type TangentCircleMode,
} from "../constraints/Tangent.ts";
import {
  collectConcentricResidualEquations,
  concentricResidual,
} from "../constraints/Concentric.ts";
import {
  collectMidpointResidualEquations,
  midpointResidual,
} from "../constraints/Midpoint.ts";
import {
  collectEqualResidualEquations,
  equalResidual,
} from "../constraints/Equal.ts";
import {
  collectSymmetricResidualEquations,
  symmetricResidual,
} from "../constraints/Symmetric.ts";
import {
  collectPointOnObjectResidualEquations,
  pointOnObjectResidual,
} from "../constraints/PointOnObject.ts";
import { collectFixResidualEquations, fixResidual } from "../constraints/Fix.ts";
import {
  distance,
  TOLERANCE,
} from "../geometry/GeometryMath.ts";
import {
  alongLineGlueResidual,
  lineEndpoint,
  nearEndpointRoleForFillet,
  signedDistanceToLine,
} from "../geometry/FilletTopology.ts";
import type { Constraint, ConstraintId } from "../model/Constraint.ts";
import { isDrivingConstraint } from "../model/Constraint.ts";
import {
  parseChamferFeature,
  parseFilletFeature,
} from "../model/FilletChamferFeature.ts";
import { parseRectangleFeature } from "../model/RectangleFeature.ts";
import type { LineGeometry } from "../model/Geometry.ts";
import type { Sketch } from "../model/Sketch.ts";

/** One scalar equation in F(X) = 0, tagged with its owning constraint. */
export interface ResidualEquation {
  readonly constraintId: ConstraintId;
  readonly value: number;
}

/**
 * Sign conventions captured once at solve start so absolute dimensions
 * (H/V distance, angle) keep a smooth, signed residual for Newton/LM.
 */
export interface ResidualContext {
  readonly distanceSign: ReadonlyMap<ConstraintId, 1 | -1>;
  readonly angleSign: ReadonlyMap<ConstraintId, 1 | -1>;
  /** Per fillet: which side of each parent the center currently sits on. */
  readonly filletSideSign: ReadonlyMap<
    ConstraintId,
    { readonly line1: 1 | -1; readonly line2: 1 | -1 }
  >;
  /** Line↔curve tangent: which side of the line the center sits on. */
  readonly tangentLineSide: ReadonlyMap<ConstraintId, 1 | -1>;
  /** Curve↔curve tangent: external vs internal contact. */
  readonly tangentCircleMode: ReadonlyMap<ConstraintId, TangentCircleMode>;
}

export function createResidualContext(sketch: Sketch): ResidualContext {
  const distanceSign = new Map<ConstraintId, 1 | -1>();
  const angleSign = new Map<ConstraintId, 1 | -1>();
  const filletSideSign = new Map<
    ConstraintId,
    { readonly line1: 1 | -1; readonly line2: 1 | -1 }
  >();
  const tangentLineSide = new Map<ConstraintId, 1 | -1>();
  const tangentCircleMode = new Map<ConstraintId, TangentCircleMode>();

  for (const constraint of sketch.constraints) {
    if (
      (constraint.type === "horizontal-distance" ||
        constraint.type === "vertical-distance") &&
      isDrivingConstraint(constraint)
    ) {
      const handles = distanceHandles(sketch, constraint.references);
      if (handles === null) {
        continue;
      }
      const a = resolveConstraintPoint(sketch, handles[0]);
      const b = resolveConstraintPoint(sketch, handles[1]);
      if (a === null || b === null) {
        continue;
      }
      const delta =
        constraint.type === "horizontal-distance" ? b.x - a.x : b.y - a.y;
      distanceSign.set(constraint.id, delta < 0 ? -1 : 1);
    }
    if (constraint.type === "angle" && isDrivingConstraint(constraint)) {
      const lineA = referencedLine(sketch, constraint.references[0]);
      const lineB = referencedLine(sketch, constraint.references[1]);
      if (lineA === null || lineB === null) {
        continue;
      }
      const signed = signedAngleBetweenLines(lineA, lineB);
      angleSign.set(constraint.id, signed < 0 ? -1 : 1);
    }
    if (constraint.type === "fillet") {
      const sides = captureFilletSideSigns(sketch, constraint);
      if (sides !== null) {
        filletSideSign.set(constraint.id, sides);
      }
    }
    if (constraint.type === "tangent") {
      const side = captureTangentLineSide(sketch, constraint);
      if (side !== null) {
        tangentLineSide.set(constraint.id, side);
      }
      const mode = captureTangentCircleMode(sketch, constraint);
      if (mode !== null) {
        tangentCircleMode.set(constraint.id, mode);
      }
    }
  }

  return {
    distanceSign,
    angleSign,
    filletSideSign,
    tangentLineSide,
    tangentCircleMode,
  };
}

/**
 * Build the signed residual vector F(X) for every supported, driving constraint.
 * Feature records (`rectangle`, `fillet`, `chamfer`) contribute topology residuals.
 * Reference dimensions contribute nothing.
 */
export function buildResidualVector(
  sketch: Sketch,
  context: ResidualContext,
): ResidualEquation[] {
  const equations: ResidualEquation[] = [];

  for (const constraint of sketch.constraints) {
    appendConstraintResiduals(sketch, constraint, context, equations);
  }

  return equations;
}

export function residualValues(equations: readonly ResidualEquation[]): number[] {
  return equations.map((equation) => equation.value);
}

export function residualConstraintIds(
  equations: readonly ResidualEquation[],
): ConstraintId[] {
  return equations.map((equation) => equation.constraintId);
}

/**
 * Residual magnitude for a single constraint when supported
 * (coincident, H/V, parallel/perp, tangent, concentric, midpoint, equal,
 * symmetric, Fix, Chunk 13 driving dimensions). Unsupported types return null.
 */
export function constraintResidual(
  sketch: Sketch,
  constraint: Constraint,
): number | null {
  if (constraint.type === "coincident") {
    // Prefer stored-handle distance so rectangle edge↔edge coincidents count.
    if (constraint.references.length === 2) {
      const a = resolveStoredPoint(sketch, constraint.references[0]!);
      const b = resolveStoredPoint(sketch, constraint.references[1]!);
      if (a !== null && b !== null) {
        return distance(a, b);
      }
    }
    return coincidentResidual(sketch, constraint);
  }
  if (isOrientationType(constraint.type)) {
    return orientationResidual(sketch, constraint);
  }
  if (isLineRelationType(constraint.type)) {
    return lineRelationResidual(sketch, constraint);
  }
  if (constraint.type === "tangent") {
    return tangentResidual(sketch, constraint);
  }
  if (constraint.type === "concentric") {
    return concentricResidual(sketch, constraint);
  }
  if (constraint.type === "midpoint") {
    return midpointResidual(sketch, constraint);
  }
  if (constraint.type === "equal") {
    return equalResidual(sketch, constraint);
  }
  if (constraint.type === "symmetric") {
    return symmetricResidual(sketch, constraint);
  }
  if (constraint.type === "point-on-object") {
    return pointOnObjectResidual(sketch, constraint);
  }
  if (constraint.type === "fix") {
    return fixResidual(sketch, constraint);
  }
  if (constraint.type === "rectangle") {
    return rectangleTopologyResidual(sketch, constraint);
  }
  if (constraint.type === "fillet") {
    return filletTopologyResidual(sketch, constraint);
  }
  if (constraint.type === "chamfer") {
    return chamferTopologyResidual(sketch, constraint);
  }
  if (isSupportedDimensionType(constraint.type)) {
    return dimensionResidual(sketch, constraint);
  }
  return null;
}

function rectangleTopologyResidual(
  sketch: Sketch,
  constraint: Constraint,
): number | null {
  const equations: ResidualEquation[] = [];
  appendRectangleTopologyResiduals(sketch, constraint, equations);
  return maxAbsEquation(equations);
}

function filletTopologyResidual(
  sketch: Sketch,
  constraint: Constraint,
): number | null {
  const equations: ResidualEquation[] = [];
  // Diagnosis path: capture signs from current geometry.
  const context = createResidualContext(sketch);
  appendFilletTopologyResiduals(sketch, constraint, context, equations);
  return maxAbsEquation(equations);
}

function chamferTopologyResidual(
  sketch: Sketch,
  constraint: Constraint,
): number | null {
  const equations: ResidualEquation[] = [];
  appendChamferTopologyResiduals(sketch, constraint, equations);
  return maxAbsEquation(equations);
}

function maxAbsEquation(
  equations: readonly ResidualEquation[],
): number | null {
  if (equations.length === 0) {
    return null;
  }
  let max = 0;
  for (const equation of equations) {
    const abs = Math.abs(equation.value);
    if (abs > max) {
      max = abs;
    }
  }
  return max;
}

/** Largest supported residual (mm for lengths, radians for angles). */
export function maxSupportedResidual(sketch: Sketch): number {
  let max = 0;
  for (const constraint of sketch.constraints) {
    const residual = constraintResidual(sketch, constraint);
    if (residual !== null && residual > max) {
      max = residual;
    }
  }
  return max;
}

export function maxCoincidentResidual(sketch: Sketch): number {
  let max = 0;
  for (const constraint of sketch.constraints) {
    if (constraint.type !== "coincident") {
      continue;
    }
    const residual = coincidentResidual(sketch, constraint);
    if (residual !== null && residual > max) {
      max = residual;
    }
  }
  return max;
}

/** Engineering gate used by edits: per-constraint tolerance, not only ||F||_∞. */
export function listUnsatisfiedConstraints(sketch: Sketch): ConstraintId[] {
  const ids: ConstraintId[] = [];
  for (const constraint of sketch.constraints) {
    const residual = constraintResidual(sketch, constraint);
    if (residual === null) {
      continue;
    }
    const tolerance = isSupportedDimensionType(constraint.type)
      ? dimensionTolerance(constraint.type)
      : isLineRelationType(constraint.type)
        ? TOLERANCE.angular
        : TOLERANCE.coincidence;
    if (residual > tolerance) {
      ids.push(constraint.id);
    }
  }
  return ids;
}

/**
 * Coincident residuals use the *stored* handles (line endpoints stay distinct
 * even when a rectangle feature would normalize both to the same corner point).
 * Collapsing those refs would let edge length drift away from corner geometry.
 */
function appendCoincidentResiduals(
  sketch: Sketch,
  constraint: Constraint,
  out: ResidualEquation[],
): void {
  if (constraint.references.length !== 2) {
    return;
  }
  const [rawA, rawB] = constraint.references;
  if (rawA === undefined || rawB === undefined) {
    return;
  }

  const aPoint = resolveStoredPoint(sketch, rawA);
  const bPoint = resolveStoredPoint(sketch, rawB);
  if (aPoint !== null && bPoint !== null) {
    out.push({ constraintId: constraint.id, value: aPoint.x - bPoint.x });
    out.push({ constraintId: constraint.id, value: aPoint.y - bPoint.y });
    return;
  }

  // Fall back to classified point–line / point–axis (uses normalized refs).
  const classified = classifyCoincident(sketch, constraint);
  if (classified?.kind !== "point-line" || classified.line === undefined) {
    return;
  }
  appendPointOnLineResidual(
    sketch,
    constraint.id,
    classified.pointA,
    classified.line,
    out,
  );
}

function appendPointOnLineResidual(
  sketch: Sketch,
  constraintId: ConstraintId,
  pointRef: ConstraintReference,
  lineRef: ConstraintReference,
  out: ResidualEquation[],
): void {
  const point = resolveConstraintPoint(sketch, pointRef);
  const segment = resolveLineObjectSegment(sketch, lineRef);
  if (point === null || segment === null) {
    return;
  }
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const length = Math.hypot(dx, dy);
  if (length <= TOLERANCE.geometric) {
    return;
  }
  const cross =
    (point.x - segment.start.x) * dy - (point.y - segment.start.y) * dx;
  out.push({ constraintId, value: cross / length });
}

/**
 * Rectangle feature stores corners as point entities and edges as lines, but
 * creation does not add point↔endpoint coincidents. Feature-local edits keep
 * them aligned; the solver needs explicit topology residuals instead.
 */
function appendRectangleTopologyResiduals(
  sketch: Sketch,
  constraint: Constraint,
  out: ResidualEquation[],
): void {
  const feature = parseRectangleFeature(constraint);
  if (feature === null) {
    return;
  }
  // Keep topology residuals for every *remaining* corner. Opened (null) corners
  // are omitted so fillet/chamfer can trim; closed corners stay glued to edges
  // (needed when datum locate lives on the corner point).
  const pairs = [
    [feature.corners.bl, feature.edges.bottom, "start"],
    [feature.corners.br, feature.edges.bottom, "end"],
    [feature.corners.br, feature.edges.right, "start"],
    [feature.corners.tr, feature.edges.right, "end"],
    [feature.corners.tr, feature.edges.top, "start"],
    [feature.corners.tl, feature.edges.top, "end"],
    [feature.corners.tl, feature.edges.left, "start"],
    [feature.corners.bl, feature.edges.left, "end"],
  ] as const;
  for (const [cornerId, edgeId, which] of pairs) {
    if (cornerId === null) {
      continue;
    }
    pushPointPairResidual(
      sketch,
      constraint.id,
      { entityId: cornerId, role: "position" },
      { entityId: edgeId, role: which },
      out,
    );
  }
}

/**
 * Fillet feature topology: center is R from each parent (tangency) and each
 * parent's near endpoint sits at the tangent foot along that parent (1-D glue).
 * Endpoint XY glue would double-count H/V and falsely remove size DOF.
 */
function appendFilletTopologyResiduals(
  sketch: Sketch,
  constraint: Constraint,
  context: ResidualContext,
  out: ResidualEquation[],
): void {
  const feature = parseFilletFeature(constraint);
  if (feature === null) {
    return;
  }
  const arc = findEntity(sketch, feature.arcId);
  const line1 = findEntity(sketch, feature.line1Id);
  const line2 = findEntity(sketch, feature.line2Id);
  if (
    arc?.type !== "arc" ||
    line1?.type !== "line" ||
    line2?.type !== "line"
  ) {
    return;
  }
  const radius = feature.radiusMm;
  if (!(radius > TOLERANCE.coincidence)) {
    return;
  }

  const sides =
    context.filletSideSign.get(constraint.id) ??
    captureFilletSideSignsFromEntities(arc.center, line1, line2);
  if (sides === null) {
    return;
  }

  const d1 = signedDistanceToLine(arc.center, line1);
  const d2 = signedDistanceToLine(arc.center, line2);
  if (d1 === null || d2 === null) {
    return;
  }
  out.push({
    constraintId: constraint.id,
    value: d1 - sides.line1 * radius,
  });
  out.push({
    constraintId: constraint.id,
    value: d2 - sides.line2 * radius,
  });

  const role1 = nearEndpointRoleForFillet(line1, line2, arc.center);
  const role2 = nearEndpointRoleForFillet(line2, line1, arc.center);
  const end1 = lineEndpoint(line1, role1);
  const end2 = lineEndpoint(line2, role2);
  const glue1 = alongLineGlueResidual(end1, arc.center, line1);
  const glue2 = alongLineGlueResidual(end2, arc.center, line2);
  if (glue1 === null || glue2 === null) {
    return;
  }
  out.push({ constraintId: constraint.id, value: glue1 });
  out.push({ constraintId: constraint.id, value: glue2 });
}

/**
 * Chamfer feature topology: each face endpoint lies on its parent (signed
 * distance) and the parent's near end is glued along that parent to the face
 * endpoint (1-D). Pairing is by proximity — `orientChamferToReference` may put
 * start on line2, so start↔line1 must not be assumed.
 */
function appendChamferTopologyResiduals(
  sketch: Sketch,
  constraint: Constraint,
  out: ResidualEquation[],
): void {
  const feature = parseChamferFeature(constraint);
  if (feature === null) {
    return;
  }
  const bevel = findEntity(sketch, feature.chamferLineId);
  const line1 = findEntity(sketch, feature.line1Id);
  const line2 = findEntity(sketch, feature.line2Id);
  if (
    bevel?.type !== "line" ||
    line1?.type !== "line" ||
    line2?.type !== "line"
  ) {
    return;
  }

  const joints = pairChamferEndpointsToParents(bevel, line1, line2);
  if (joints === null) {
    return;
  }
  for (const joint of joints) {
    const role = nearEndpointRoleForFillet(
      joint.parent,
      joint.partner,
      joint.point,
    );
    const dist = signedDistanceToLine(joint.point, joint.parent);
    const glue = alongLineGlueResidual(
      lineEndpoint(joint.parent, role),
      joint.point,
      joint.parent,
    );
    if (dist === null || glue === null) {
      return;
    }
    out.push({ constraintId: constraint.id, value: dist });
    out.push({ constraintId: constraint.id, value: glue });
  }
}

/** Match each parent to the bevel endpoint that already lies nearer that line. */
function pairChamferEndpointsToParents(
  bevel: LineGeometry,
  line1: LineGeometry,
  line2: LineGeometry,
):
  | readonly {
      readonly parent: LineGeometry;
      readonly partner: LineGeometry;
      readonly point: { readonly x: number; readonly y: number };
    }[]
  | null {
  const distTo = (
    point: { readonly x: number; readonly y: number },
    line: LineGeometry,
  ): number => Math.abs(signedDistanceToLine(point, line) ?? Number.POSITIVE_INFINITY);

  const startOn1 = distTo(bevel.start, line1);
  const endOn1 = distTo(bevel.end, line1);
  let point1 = startOn1 <= endOn1 ? bevel.start : bevel.end;
  let point2 = point1 === bevel.start ? bevel.end : bevel.start;

  // If both endpoints prefer the same parent, assign by which pairing is closer overall.
  if (
    distTo(point1, line1) + distTo(point2, line2) >
    distTo(bevel.end, line1) + distTo(bevel.start, line2) + 1e-12
  ) {
    point1 = bevel.end;
    point2 = bevel.start;
  }

  return [
    { parent: line1, partner: line2, point: point1 },
    { parent: line2, partner: line1, point: point2 },
  ];
}

function captureFilletSideSigns(
  sketch: Sketch,
  constraint: Constraint,
): { readonly line1: 1 | -1; readonly line2: 1 | -1 } | null {
  const feature = parseFilletFeature(constraint);
  if (feature === null) {
    return null;
  }
  const arc = findEntity(sketch, feature.arcId);
  const line1 = findEntity(sketch, feature.line1Id);
  const line2 = findEntity(sketch, feature.line2Id);
  if (
    arc?.type !== "arc" ||
    line1?.type !== "line" ||
    line2?.type !== "line"
  ) {
    return null;
  }
  return captureFilletSideSignsFromEntities(arc.center, line1, line2);
}

function captureFilletSideSignsFromEntities(
  center: { readonly x: number; readonly y: number },
  line1: LineGeometry,
  line2: LineGeometry,
): { readonly line1: 1 | -1; readonly line2: 1 | -1 } | null {
  const d1 = signedDistanceToLine(center, line1);
  const d2 = signedDistanceToLine(center, line2);
  if (d1 === null || d2 === null) {
    return null;
  }
  return {
    line1: d1 < 0 ? -1 : 1,
    line2: d2 < 0 ? -1 : 1,
  };
}

function pushPointPairResidual(
  sketch: Sketch,
  constraintId: ConstraintId,
  a: { readonly entityId: string; readonly role: string },
  b: { readonly entityId: string; readonly role: string },
  out: ResidualEquation[],
): void {
  const pa = resolveStoredPoint(sketch, a);
  const pb = resolveStoredPoint(sketch, b);
  if (pa === null || pb === null) {
    return;
  }
  out.push({ constraintId, value: pa.x - pb.x });
  out.push({ constraintId, value: pa.y - pb.y });
}

/** World position of a ref as stored on the entity (no rectangle corner rewrite). */
function resolveStoredPoint(
  sketch: Sketch,
  ref: { readonly entityId: string; readonly role: string },
): { x: number; y: number } | null {
  // Includes frame origin datums (not present in geometry[]).
  return resolveConstraintPoint(sketch, {
    entityId: ref.entityId,
    role: ref.role as ConstraintReference["role"],
  });
}

function appendConstraintResiduals(
  sketch: Sketch,
  constraint: Constraint,
  context: ResidualContext,
  out: ResidualEquation[],
): void {
  if (constraint.type === "coincident") {
    appendCoincidentResiduals(sketch, constraint, out);
    return;
  }

  if (isOrientationType(constraint.type)) {
    const handles = orientationHandles(sketch, constraint.references);
    if (handles === null) {
      return;
    }
    const a = resolveConstraintPoint(sketch, handles[0]);
    const b = resolveConstraintPoint(sketch, handles[1]);
    if (a === null || b === null) {
      return;
    }
    out.push({
      constraintId: constraint.id,
      value: constraint.type === "horizontal" ? a.y - b.y : a.x - b.x,
    });
    return;
  }

  if (isLineRelationType(constraint.type)) {
    for (const equation of collectLineRelationResidualEquations(
      sketch,
      constraint,
    )) {
      out.push(equation);
    }
    return;
  }

  if (constraint.type === "tangent") {
    for (const equation of collectTangentResidualEquations(sketch, constraint, {
      lineSide: context.tangentLineSide.get(constraint.id) ?? null,
      circleMode: context.tangentCircleMode.get(constraint.id) ?? null,
    })) {
      out.push(equation);
    }
    return;
  }

  if (constraint.type === "concentric") {
    for (const equation of collectConcentricResidualEquations(
      sketch,
      constraint,
    )) {
      out.push(equation);
    }
    return;
  }

  if (constraint.type === "midpoint") {
    for (const equation of collectMidpointResidualEquations(
      sketch,
      constraint,
    )) {
      out.push(equation);
    }
    return;
  }

  if (constraint.type === "equal") {
    for (const equation of collectEqualResidualEquations(
      sketch,
      constraint,
    )) {
      out.push(equation);
    }
    return;
  }

  if (constraint.type === "symmetric") {
    for (const equation of collectSymmetricResidualEquations(
      sketch,
      constraint,
    )) {
      out.push(equation);
    }
    return;
  }

  if (constraint.type === "point-on-object") {
    for (const equation of collectPointOnObjectResidualEquations(
      sketch,
      constraint,
    )) {
      out.push(equation);
    }
    return;
  }

  if (constraint.type === "fix") {
    for (const equation of collectFixResidualEquations(sketch, constraint)) {
      out.push(equation);
    }
    return;
  }

  if (constraint.type === "rectangle") {
    appendRectangleTopologyResiduals(sketch, constraint, out);
    return;
  }

  if (constraint.type === "fillet") {
    appendFilletTopologyResiduals(sketch, constraint, context, out);
    return;
  }

  if (constraint.type === "chamfer") {
    appendChamferTopologyResiduals(sketch, constraint, out);
    return;
  }

  if (
    !isSupportedDimensionType(constraint.type) ||
    !isDrivingConstraint(constraint) ||
    constraint.value === undefined
  ) {
    return;
  }

  switch (constraint.type) {
    case "length": {
      const line = referencedLine(sketch, constraint.references[0]);
      if (line === null) {
        return;
      }
      out.push({
        constraintId: constraint.id,
        value: distance(line.start, line.end) - constraint.value,
      });
      return;
    }
    case "distance": {
      const handles = distanceHandles(sketch, constraint.references);
      if (handles === null) {
        return;
      }
      const a = resolveConstraintPoint(sketch, handles[0]);
      const b = resolveConstraintPoint(sketch, handles[1]);
      if (a === null || b === null) {
        return;
      }
      out.push({
        constraintId: constraint.id,
        value: distance(a, b) - constraint.value,
      });
      return;
    }
    case "horizontal-distance":
    case "vertical-distance": {
      const handles = distanceHandles(sketch, constraint.references);
      if (handles === null) {
        return;
      }
      const a = resolveConstraintPoint(sketch, handles[0]);
      const b = resolveConstraintPoint(sketch, handles[1]);
      if (a === null || b === null) {
        return;
      }
      const sign = context.distanceSign.get(constraint.id) ?? 1;
      const delta =
        constraint.type === "horizontal-distance" ? b.x - a.x : b.y - a.y;
      out.push({
        constraintId: constraint.id,
        value: delta - sign * constraint.value,
      });
      return;
    }
    case "radius":
    case "diameter": {
      const entity = findEntity(sketch, constraint.references[0]!.entityId);
      if (entity?.type !== "circle" && entity?.type !== "arc") {
        return;
      }
      const target =
        constraint.type === "radius" ? constraint.value : constraint.value / 2;
      out.push({
        constraintId: constraint.id,
        value: entity.radius - target,
      });
      return;
    }
    case "angle": {
      const lineA = referencedLine(sketch, constraint.references[0]);
      const lineB = referencedLine(sketch, constraint.references[1]);
      if (lineA === null || lineB === null) {
        return;
      }
      const sign = context.angleSign.get(constraint.id) ?? 1;
      out.push({
        constraintId: constraint.id,
        value: signedAngleBetweenLines(lineA, lineB) - sign * constraint.value,
      });
      return;
    }
    case "coordinate-x":
    case "coordinate-y": {
      const point = resolveCoordinatePoint(sketch, constraint.references[0]);
      if (point === null) {
        return;
      }
      out.push({
        constraintId: constraint.id,
        value:
          (constraint.type === "coordinate-x" ? point.x : point.y) -
          constraint.value,
      });
    }
  }
}
