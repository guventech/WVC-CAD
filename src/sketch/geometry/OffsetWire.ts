import type {
  ArcGeometry,
  EntityId,
  LineGeometry,
} from "../model/Geometry.ts";
import type { Sketch } from "../model/Sketch.ts";
import { pointOnCircle } from "./EntityFeatures.ts";
import {
  arcSweepRadians,
  pointsApproximatelyEqual,
  TOLERANCE,
} from "./GeometryMath.ts";
import type { Point2D } from "./Point2D.ts";

type WireEntity = LineGeometry | ArcGeometry;

/**
 * Build an ordered closed polyline for offset from a profile loop's entity ids.
 * Lines contribute endpoints; arcs are densified (~15° steps) so miters stay DIY
 * polyline-based (no Clipper / exact arc offset).
 */
export function orderedClosedLoopPolyline(
  sketch: Sketch,
  entityIds: readonly EntityId[],
): Point2D[] | null {
  if (entityIds.length < 3) {
    return null;
  }

  const edges: WireEntity[] = [];
  for (const id of entityIds) {
    const entity = sketch.geometry.find((g) => g.id === id);
    if (entity === undefined || entity.construction) {
      return null;
    }
    if (entity.type === "line") {
      if (
        Math.hypot(entity.end.x - entity.start.x, entity.end.y - entity.start.y) <=
        TOLERANCE.coincidence
      ) {
        return null;
      }
      edges.push(entity);
    } else if (entity.type === "arc") {
      if (!(entity.radius > TOLERANCE.coincidence)) {
        return null;
      }
      edges.push(entity);
    } else {
      return null;
    }
  }
  if (edges.length !== entityIds.length) {
    return null;
  }

  const remaining = new Map(edges.map((edge) => [edge.id, edge]));
  const first = edges[0]!;
  remaining.delete(first.id);

  const firstEnds = wireEnds(first);
  const vertices: Point2D[] = [firstEnds.start];
  appendArcInteriorSamples(vertices, first, true);
  let tip = firstEnds.end;
  if (remaining.size > 0) {
    vertices.push(tip);
  }

  while (remaining.size > 0) {
    let next: WireEntity | null = null;
    let forward = true;
    for (const candidate of remaining.values()) {
      const ends = wireEnds(candidate);
      if (pointsApproximatelyEqual(ends.start, tip, TOLERANCE.coincidence)) {
        next = candidate;
        forward = true;
        break;
      }
      if (pointsApproximatelyEqual(ends.end, tip, TOLERANCE.coincidence)) {
        next = candidate;
        forward = false;
        break;
      }
    }
    if (next === null) {
      return null;
    }
    remaining.delete(next.id);
    const ends = wireEnds(next);
    const nextTip = forward ? ends.end : ends.start;
    appendArcInteriorSamples(vertices, next, forward);

    if (remaining.size === 0) {
      if (
        !pointsApproximatelyEqual(nextTip, vertices[0]!, TOLERANCE.coincidence)
      ) {
        return null;
      }
      break;
    }
    vertices.push(nextTip);
    tip = nextTip;
  }

  return vertices.length >= 3 ? vertices : null;
}

function wireEnds(entity: WireEntity): {
  readonly start: Point2D;
  readonly end: Point2D;
} {
  if (entity.type === "line") {
    return { start: entity.start, end: entity.end };
  }
  return {
    start: pointOnCircle(entity.center, entity.radius, entity.startAngle),
    end: pointOnCircle(entity.center, entity.radius, entity.endAngle),
  };
}

/** Interior samples along the arc in walk direction (excludes endpoints). */
function appendArcInteriorSamples(
  vertices: Point2D[],
  entity: WireEntity,
  forward: boolean,
): void {
  if (entity.type !== "arc") {
    return;
  }
  const sweep = arcSweepRadians(entity.startAngle, entity.endAngle);
  const steps = Math.max(2, Math.ceil(Math.abs(sweep) / (Math.PI / 12)));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const angle = forward
      ? entity.startAngle + sweep * t
      : entity.endAngle - sweep * t;
    vertices.push(pointOnCircle(entity.center, entity.radius, angle));
  }
}
