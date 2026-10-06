import type { ArcGeometry, LineGeometry } from "../model/Geometry.ts";
import type { Point2D } from "./Point2D.ts";
import {
  angleFromTo,
  arcSweepRadians,
  distance,
  isApproximatelyEqual,
  TOLERANCE,
} from "./GeometryMath.ts";
import { intersectInfiniteLines } from "./Intersections.ts";
import { createArcGeometry } from "../commands/CreateGeometryCommand.ts";

export const MIN_FILLET_RADIUS_MM = 0.5;
export const MIN_CHAMFER_DISTANCE_MM = 0.5;

export interface LineCornerTrim {
  readonly start: Point2D;
  readonly end: Point2D;
}

export interface FilletGeometryPlan {
  readonly intersection: Point2D;
  readonly line1Trim: LineCornerTrim;
  readonly line2Trim: LineCornerTrim;
  readonly arc: ArcGeometry;
}

export interface ChamferGeometryPlan {
  readonly intersection: Point2D;
  readonly line1Trim: LineCornerTrim;
  readonly line2Trim: LineCornerTrim;
  readonly chamferLine: LineCornerTrim;
}

function normalizeVector(v: Point2D): Point2D | null {
  const len = Math.hypot(v.x, v.y);
  if (len <= TOLERANCE.geometric) {
    return null;
  }
  return { x: v.x / len, y: v.y / len };
}

/** Unit direction from `corner` into the body of `line` (away from the nearer endpoint). */
export function directionIntoLineFromCorner(
  line: LineGeometry,
  corner: Point2D,
): Point2D | null {
  const toStart = distance(corner, line.start);
  const toEnd = distance(corner, line.end);
  if (toStart <= toEnd) {
    return normalizeVector({
      x: line.end.x - line.start.x,
      y: line.end.y - line.start.y,
    });
  }
  return normalizeVector({
    x: line.start.x - line.end.x,
    y: line.start.y - line.end.y,
  });
}

function pointInCounterClockwiseWedge(
  origin: Point2D,
  u: Point2D,
  v: Point2D,
  point: Point2D,
): boolean {
  const w = { x: point.x - origin.x, y: point.y - origin.y };
  const crossUV = u.x * v.y - u.y * v.x;
  if (Math.abs(crossUV) <= TOLERANCE.geometric) {
    return false;
  }
  const crossUW = u.x * w.y - u.y * w.x;
  const crossWV = w.x * v.y - w.y * v.x;
  if (crossUV > 0) {
    return crossUW >= -TOLERANCE.geometric && crossWV >= -TOLERANCE.geometric;
  }
  return crossUW <= TOLERANCE.geometric && crossWV <= TOLERANCE.geometric;
}

/**
 * Pick unit directions along each line from the intersection into the corner
 * wedge that contains `pickPoint`.
 */
export function pickCornerDirections(
  line1: LineGeometry,
  line2: LineGeometry,
  intersection: Point2D,
  pickPoint: Point2D,
): { readonly u1: Point2D; readonly u2: Point2D } | null {
  const options1 = [
    normalizeVector({ x: line1.end.x - intersection.x, y: line1.end.y - intersection.y }),
    normalizeVector({ x: line1.start.x - intersection.x, y: line1.start.y - intersection.y }),
  ].filter((item): item is Point2D => item !== null);
  const options2 = [
    normalizeVector({ x: line2.end.x - intersection.x, y: line2.end.y - intersection.y }),
    normalizeVector({ x: line2.start.x - intersection.x, y: line2.start.y - intersection.y }),
  ].filter((item): item is Point2D => item !== null);

  for (const u1 of options1) {
    for (const u2 of options2) {
      if (pointInCounterClockwiseWedge(intersection, u1, u2, pickPoint)) {
        return { u1, u2 };
      }
    }
  }
  return null;
}

/**
 * Replace the corner-near endpoint with `tangent`, keeping a far endpoint that
 * lies further along the fillet into the line body. Using raw "farther from
 * corner" is wrong when the segment still extends past the opposite partner
 * (extreme length-restore / drag): that endpoint is on the wrong side of the
 * corner and must not be kept.
 */
function trimLineAtCorner(
  line: LineGeometry,
  corner: Point2D,
  tangent: Point2D,
): LineCornerTrim | null {
  const intoBody = normalizeVector({
    x: tangent.x - corner.x,
    y: tangent.y - corner.y,
  });
  if (intoBody === null) {
    return null;
  }
  const proj = (point: Point2D): number =>
    (point.x - corner.x) * intoBody.x + (point.y - corner.y) * intoBody.y;
  const tangentProj = proj(tangent);
  if (!(tangentProj > TOLERANCE.coincidence)) {
    return null;
  }

  const startProj = proj(line.start);
  const endProj = proj(line.end);
  // Far end must lie strictly beyond the tangent into the body.
  let far: Point2D;
  if (
    startProj > tangentProj + TOLERANCE.coincidence &&
    endProj > tangentProj + TOLERANCE.coincidence
  ) {
    far = startProj >= endProj ? line.start : line.end;
  } else if (startProj > tangentProj + TOLERANCE.coincidence) {
    far = line.start;
  } else if (endProj > tangentProj + TOLERANCE.coincidence) {
    far = line.end;
  } else {
    return null;
  }

  // Preserve which parametric end faced the corner when both ends were valid.
  const atStart = distance(corner, line.start) <= distance(corner, line.end);
  if (atStart) {
    return {
      start: { x: tangent.x, y: tangent.y },
      end: { x: far.x, y: far.y },
    };
  }
  return {
    start: { x: far.x, y: far.y },
    end: { x: tangent.x, y: tangent.y },
  };
}

export function computeLineLineFillet(
  line1: LineGeometry,
  line2: LineGeometry,
  radius: number,
  pickPoint: Point2D,
  options?: {
    readonly arcId?: string;
    readonly construction?: boolean;
  },
): FilletGeometryPlan | null {
  if (!(radius >= MIN_FILLET_RADIUS_MM)) {
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

  const intersection = hit.point;
  const dirs = pickCornerDirections(line1, line2, intersection, pickPoint);
  if (dirs === null) {
    return null;
  }

  const { u1, u2 } = dirs;
  const cosTheta = Math.max(-1, Math.min(1, u1.x * u2.x + u1.y * u2.y));
  const theta = Math.acos(cosTheta);
  if (theta <= TOLERANCE.geometric || theta >= Math.PI - TOLERANCE.geometric) {
    return null;
  }

  const tangentDist = radius / Math.tan(theta / 2);
  const maxLeg1 = Math.max(
    distance(intersection, line1.start),
    distance(intersection, line1.end),
  );
  const maxLeg2 = Math.max(
    distance(intersection, line2.start),
    distance(intersection, line2.end),
  );
  const maxTangent = Math.min(maxLeg1, maxLeg2) - TOLERANCE.coincidence;
  if (!(tangentDist <= maxTangent)) {
    return null;
  }

  const t1 = {
    x: intersection.x + u1.x * tangentDist,
    y: intersection.y + u1.y * tangentDist,
  };
  const t2 = {
    x: intersection.x + u2.x * tangentDist,
    y: intersection.y + u2.y * tangentDist,
  };

  const bisector = normalizeVector({ x: u1.x + u2.x, y: u1.y + u2.y });
  if (bisector === null) {
    return null;
  }
  const centerDist = radius / Math.sin(theta / 2);
  const center = {
    x: intersection.x + bisector.x * centerDist,
    y: intersection.y + bisector.y * centerDist,
  };

  // Fillet arc must sweep the interior corner (π − θ), not the long way around
  // the circle (that looks like a bump / outside fillet).
  const expectedSweep = Math.PI - theta;
  const angle1 = angleFromTo(center, t1);
  const angle2 = angleFromTo(center, t2);
  const ordered = orderArcAnglesForSweep(angle1, angle2, expectedSweep);
  if (ordered === null) {
    return null;
  }
  const arc = createArcGeometry(center, radius, ordered.startAngle, ordered.endAngle, {
    id: options?.arcId,
    construction:
      options?.construction ?? (line1.construction || line2.construction),
  });
  if (arc === null) {
    return null;
  }

  const line1Trim = trimLineAtCorner(line1, intersection, t1);
  const line2Trim = trimLineAtCorner(line2, intersection, t2);
  if (line1Trim === null || line2Trim === null) {
    return null;
  }

  return {
    intersection,
    line1Trim,
    line2Trim,
    arc,
  };
}

export function computeLineLineChamfer(
  line1: LineGeometry,
  line2: LineGeometry,
  chamferDistance: number,
  pickPoint: Point2D,
): ChamferGeometryPlan | null {
  if (!(chamferDistance >= MIN_CHAMFER_DISTANCE_MM)) {
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

  const intersection = hit.point;
  const dirs = pickCornerDirections(line1, line2, intersection, pickPoint);
  if (dirs === null) {
    return null;
  }

  const { u1, u2 } = dirs;
  const maxLeg1 = Math.max(
    distance(intersection, line1.start),
    distance(intersection, line1.end),
  );
  const maxLeg2 = Math.max(
    distance(intersection, line2.start),
    distance(intersection, line2.end),
  );
  const maxChamfer = Math.min(maxLeg1, maxLeg2) - TOLERANCE.coincidence;
  if (!(chamferDistance <= maxChamfer)) {
    return null;
  }

  const c1 = {
    x: intersection.x + u1.x * chamferDistance,
    y: intersection.y + u1.y * chamferDistance,
  };
  const c2 = {
    x: intersection.x + u2.x * chamferDistance,
    y: intersection.y + u2.y * chamferDistance,
  };

  const line1Trim = trimLineAtCorner(line1, intersection, c1);
  const line2Trim = trimLineAtCorner(line2, intersection, c2);
  if (line1Trim === null || line2Trim === null) {
    return null;
  }
  if (distance(c1, c2) <= TOLERANCE.coincidence) {
    return null;
  }

  return {
    intersection,
    line1Trim,
    line2Trim,
    chamferLine: { start: c1, end: c2 },
  };
}

function rotateUnit(u: Point2D, angleRad: number): Point2D {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  return { x: u.x * c - u.y * s, y: u.x * s + u.y * c };
}

/**
 * Chamfer driven by face length and angle to a reference parent leg
 * (CAD-style length × angle). `reference` selects which parent the angle is
 * measured against (`first` = line1).
 */
export function computeLineLineChamferFromLengthAngle(
  line1: LineGeometry,
  line2: LineGeometry,
  lengthMm: number,
  angleRad: number,
  pickPoint: Point2D,
  reference: "first" | "second" = "first",
): ChamferGeometryPlan | null {
  if (!(lengthMm >= MIN_CHAMFER_DISTANCE_MM)) {
    return null;
  }
  if (
    !(angleRad > TOLERANCE.angular && angleRad < Math.PI - TOLERANCE.angular)
  ) {
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

  const intersection = hit.point;
  const dirs = pickCornerDirections(line1, line2, intersection, pickPoint);
  if (dirs === null) {
    return null;
  }

  const { u1, u2 } = dirs;
  const uref = reference === "first" ? u1 : u2;
  const uother = reference === "first" ? u2 : u1;
  const maxRef =
    Math.max(
      distance(intersection, reference === "first" ? line1.start : line2.start),
      distance(intersection, reference === "first" ? line1.end : line2.end),
    ) - TOLERANCE.coincidence;
  const maxOther =
    Math.max(
      distance(intersection, reference === "first" ? line2.start : line1.start),
      distance(intersection, reference === "first" ? line2.end : line1.end),
    ) - TOLERANCE.coincidence;

  for (const targetAngle of [angleRad, Math.PI - angleRad]) {
    if (
      !(
        targetAngle > TOLERANCE.angular &&
        targetAngle < Math.PI - TOLERANCE.angular
      )
    ) {
      continue;
    }
    for (const rot of [targetAngle, -targetAngle]) {
      const v = rotateUnit(uref, rot);
      // uother * tOther - uref * tRef = length * v
      const rx = lengthMm * v.x;
      const ry = lengthMm * v.y;
      const det = -uref.x * uother.y + uother.x * uref.y;
      if (Math.abs(det) <= TOLERANCE.geometric) {
        continue;
      }
      const tRef = (rx * uother.y - uother.x * ry) / det;
      const tOther = (-uref.x * ry + rx * uref.y) / det;
      if (
        !(tRef >= MIN_CHAMFER_DISTANCE_MM) ||
        !(tOther >= MIN_CHAMFER_DISTANCE_MM) ||
        !(tRef <= maxRef) ||
        !(tOther <= maxOther)
      ) {
        continue;
      }

      const cRef = {
        x: intersection.x + uref.x * tRef,
        y: intersection.y + uref.y * tRef,
      };
      const cOther = {
        x: intersection.x + uother.x * tOther,
        y: intersection.y + uother.y * tOther,
      };
      if (distance(cRef, cOther) <= TOLERANCE.coincidence) {
        continue;
      }

      const c1 = reference === "first" ? cRef : cOther;
      const c2 = reference === "first" ? cOther : cRef;
      const line1Trim = trimLineAtCorner(line1, intersection, c1);
      const line2Trim = trimLineAtCorner(line2, intersection, c2);
      if (line1Trim === null || line2Trim === null) {
        continue;
      }

      return {
        intersection,
        line1Trim,
        line2Trim,
        chamferLine: { start: cRef, end: cOther },
      };
    }
  }

  return null;
}

/** Infer fillet radius from pick distance (clamped). */
export function filletRadiusFromPick(
  intersection: Point2D,
  pickPoint: Point2D,
): number {
  return Math.max(MIN_FILLET_RADIUS_MM, distance(intersection, pickPoint));
}

export function chamferDistanceFromPick(
  intersection: Point2D,
  pickPoint: Point2D,
): number {
  return Math.max(MIN_CHAMFER_DISTANCE_MM, distance(intersection, pickPoint));
}

/**
 * Choose start→end so the stored CCW arc matches `expectedSweep`.
 * Prefer a1→a2; if that sweep is wrong, swap to a2→a1.
 */
export function orderArcAnglesForSweep(
  a1: number,
  a2: number,
  expectedSweep: number,
  tolerance: number = 1e-3,
): { readonly startAngle: number; readonly endAngle: number } | null {
  const sweep12 = arcSweepRadians(a1, a2);
  if (isApproximatelyEqual(sweep12, expectedSweep, tolerance)) {
    return { startAngle: a1, endAngle: a2 };
  }
  const sweep21 = arcSweepRadians(a2, a1);
  if (isApproximatelyEqual(sweep21, expectedSweep, tolerance)) {
    return { startAngle: a2, endAngle: a1 };
  }
  // Prefer the orientation whose sweep is closer to the expected fillet angle.
  if (Math.abs(sweep12 - expectedSweep) <= Math.abs(sweep21 - expectedSweep)) {
    return { startAngle: a1, endAngle: a2 };
  }
  return { startAngle: a2, endAngle: a1 };
}

/** CCW sweep preview helper. */
export function arcSweepDegreesForPlan(arc: ArcGeometry): number {
  return (arcSweepRadians(arc.startAngle, arc.endAngle) * 180) / Math.PI;
}
