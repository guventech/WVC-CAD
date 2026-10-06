import { listSolidProfileGeometry } from "./ProfileGeometry.ts";
import {
  circleContainsCircle,
  pointInPolygon,
  polygonCentroid,
  polygonContainsCircle,
  signedPolygonArea,
} from "./ProfileLoopMath.ts";
import type { ProfileAnalysis, ProfileLoop } from "./ProfileTypes.ts";
import { pointOnCircle } from "../geometry/EntityFeatures.ts";
import {
  arcSweepRadians,
  pointsApproximatelyEqual,
  TOLERANCE,
} from "../geometry/GeometryMath.ts";
import { intersectLineSegments } from "../geometry/Intersections.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import type {
  ArcGeometry,
  CircleGeometry,
  EntityId,
  LineGeometry,
} from "../model/Geometry.ts";
import type { Sketch } from "../model/Sketch.ts";

export type { ProfileAnalysis, ProfileLoop, LoopOrientation } from "./ProfileTypes.ts";

interface HalfEdge {
  readonly entityId: EntityId;
  readonly from: number;
  readonly to: number;
}

interface WireLoopDraft {
  readonly entityIds: readonly EntityId[];
  /** Junction nodes plus arc sample points for area / nesting. */
  readonly vertices: readonly Point2D[];
}

interface LoopGeometry {
  readonly loop: ProfileLoop;
  readonly vertices: readonly Point2D[] | null;
  readonly circle: CircleGeometry | null;
  readonly testPoint: Point2D;
}

/**
 * Detect closed profiles (line/arc wires, circles), holes via nesting, and open wire.
 * Construction geometry is excluded.
 */
export function analyzeProfiles(sketch: Sketch): ProfileAnalysis {
  const geometry = sketch.geometry;
  const solids = listSolidProfileGeometry(geometry);
  const lines = solids.filter(
    (entity): entity is LineGeometry => entity.type === "line",
  );
  const arcs = solids.filter(
    (entity): entity is ArcGeometry =>
      entity.type === "arc" && entity.radius > TOLERANCE.coincidence,
  );
  const circles = solids.filter(
    (entity): entity is CircleGeometry =>
      entity.type === "circle" && entity.radius > TOLERANCE.coincidence,
  );

  const selfIntersectionCount = countLineSelfIntersections(lines);
  const { nodes, halfEdgesAt, entityById } = buildWire(lines, arcs);

  const usedEntityIds = new Set<EntityId>();
  const drafts: WireLoopDraft[] = [];

  const seedEdges: HalfEdge[] = [];
  for (const edges of halfEdgesAt.values()) {
    for (const edge of edges) {
      seedEdges.push(edge);
    }
  }

  for (const seed of seedEdges) {
    if (usedEntityIds.has(seed.entityId)) {
      continue;
    }
    const walked = walkClosedLoop(seed, halfEdgesAt, nodes, entityById);
    if (walked === null) {
      continue;
    }
    for (const id of walked.entityIds) {
      usedEntityIds.add(id);
    }
    drafts.push(walked);
  }

  let loopSerial = 0;
  const loopGeometry: LoopGeometry[] = [];

  for (const draft of drafts) {
    const signed = signedPolygonArea(draft.vertices);
    if (Math.abs(signed) <= TOLERANCE.coincidence) {
      continue;
    }
    const loop: ProfileLoop = {
      id: nextLoopId(loopSerial++),
      entityIds: draft.entityIds,
      closed: true,
      orientation: signed >= 0 ? "CCW" : "CW",
      area: Math.abs(signed),
    };
    loopGeometry.push({
      loop,
      vertices: draft.vertices,
      circle: null,
      testPoint: polygonCentroid(draft.vertices),
    });
  }

  for (const circle of circles) {
    const loop: ProfileLoop = {
      id: nextLoopId(loopSerial++),
      entityIds: [circle.id],
      closed: true,
      orientation: "CCW",
      area: Math.PI * circle.radius * circle.radius,
    };
    loopGeometry.push({
      loop,
      vertices: null,
      circle,
      testPoint: circle.center,
    });
  }

  const nested = assignLoopParents(loopGeometry);
  const closedEntityIds = new Set(nested.flatMap((loop) => loop.entityIds));
  const openEntityIds = solids
    .filter(
      (entity) =>
        !closedEntityIds.has(entity.id) &&
        (entity.type === "line" ||
          entity.type === "arc" ||
          entity.type === "circle"),
    )
    .map((entity) => entity.id);

  const outerLoopCount = nested.filter(
    (loop) => loop.parentLoopId === undefined,
  ).length;
  const holeLoopCount = nested.filter(
    (loop) => loop.parentLoopId !== undefined,
  ).length;

  return {
    loops: nested,
    openEntityIds,
    selfIntersectionCount,
    outerLoopCount,
    holeLoopCount,
  };
}

function nextLoopId(serial: number): string {
  return `profile-loop-${serial + 1}`;
}

function countLineSelfIntersections(lines: readonly LineGeometry[]): number {
  let count = 0;
  for (let i = 0; i < lines.length; i += 1) {
    for (let j = i + 1; j < lines.length; j += 1) {
      const hit = intersectLineSegments(
        lines[i]!.start,
        lines[i]!.end,
        lines[j]!.start,
        lines[j]!.end,
      );
      if (hit !== null) {
        count += 1;
      }
    }
  }
  return count;
}

function arcEndPoints(arc: ArcGeometry): {
  readonly start: Point2D;
  readonly end: Point2D;
} {
  return {
    start: pointOnCircle(arc.center, arc.radius, arc.startAngle),
    end: pointOnCircle(arc.center, arc.radius, arc.endAngle),
  };
}

function buildWire(
  lines: readonly LineGeometry[],
  arcs: readonly ArcGeometry[],
): {
  readonly nodes: Point2D[];
  readonly halfEdgesAt: Map<number, HalfEdge[]>;
  readonly entityById: Map<EntityId, LineGeometry | ArcGeometry>;
} {
  const nodes: Point2D[] = [];
  const entityById = new Map<EntityId, LineGeometry | ArcGeometry>();
  const nodeIndex = (point: Point2D): number => {
    for (let i = 0; i < nodes.length; i += 1) {
      if (pointsApproximatelyEqual(nodes[i]!, point, TOLERANCE.coincidence)) {
        return i;
      }
    }
    nodes.push(point);
    return nodes.length - 1;
  };

  const halfEdgesAt = new Map<number, HalfEdge[]>();
  const addHalf = (edge: HalfEdge) => {
    const list = halfEdgesAt.get(edge.from) ?? [];
    list.push(edge);
    halfEdgesAt.set(edge.from, list);
  };

  for (const line of lines) {
    if (segmentLength(line.start, line.end) <= TOLERANCE.coincidence) {
      continue;
    }
    entityById.set(line.id, line);
    const a = nodeIndex(line.start);
    const b = nodeIndex(line.end);
    addHalf({ entityId: line.id, from: a, to: b });
    addHalf({ entityId: line.id, from: b, to: a });
  }

  for (const arc of arcs) {
    const ends = arcEndPoints(arc);
    if (segmentLength(ends.start, ends.end) <= TOLERANCE.coincidence) {
      // Near-full circle as a lone arc is unusual; skip degenerate chords.
      continue;
    }
    entityById.set(arc.id, arc);
    const a = nodeIndex(ends.start);
    const b = nodeIndex(ends.end);
    addHalf({ entityId: arc.id, from: a, to: b });
    addHalf({ entityId: arc.id, from: b, to: a });
  }

  return { nodes, halfEdgesAt, entityById };
}

function segmentLength(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function walkClosedLoop(
  start: HalfEdge,
  halfEdgesAt: Map<number, HalfEdge[]>,
  nodes: readonly Point2D[],
  entityById: Map<EntityId, LineGeometry | ArcGeometry>,
): WireLoopDraft | null {
  const entityIds: EntityId[] = [];
  const edgeSequence: HalfEdge[] = [];
  let edge: HalfEdge | undefined = start;

  for (let step = 0; step < 10_000 && edge !== undefined; step += 1) {
    entityIds.push(edge.entityId);
    edgeSequence.push(edge);

    if (edge.to === start.from && entityIds.length >= 3) {
      return {
        entityIds,
        vertices: densifyLoopVertices(edgeSequence, nodes, entityById),
      };
    }

    edge = nextHalfEdge(edge, halfEdgesAt);
  }

  return null;
}

/** Insert arc sample points so rounded profiles get a useful shoelace area. */
function densifyLoopVertices(
  edges: readonly HalfEdge[],
  nodes: readonly Point2D[],
  entityById: Map<EntityId, LineGeometry | ArcGeometry>,
): Point2D[] {
  const vertices: Point2D[] = [];
  for (const edge of edges) {
    vertices.push(nodes[edge.from]!);
    const entity = entityById.get(edge.entityId);
    if (entity?.type === "arc") {
      const samples = arcSamplesAlongHalfEdge(entity, edge, nodes);
      vertices.push(...samples);
    }
  }
  return vertices;
}

function arcSamplesAlongHalfEdge(
  arc: ArcGeometry,
  edge: HalfEdge,
  nodes: readonly Point2D[],
): Point2D[] {
  const ends = arcEndPoints(arc);
  const fromPt = nodes[edge.from]!;
  const forward =
    pointsApproximatelyEqual(fromPt, ends.start, TOLERANCE.coincidence);
  const sweep = arcSweepRadians(arc.startAngle, arc.endAngle);
  // Sample mid-sweep in the travel direction of this half-edge.
  const midAngle = forward
    ? arc.startAngle + sweep / 2
    : arc.endAngle - sweep / 2;
  return [pointOnCircle(arc.center, arc.radius, midAngle)];
}

function nextHalfEdge(
  current: HalfEdge,
  halfEdgesAt: Map<number, HalfEdge[]>,
): HalfEdge | undefined {
  const leaving = halfEdgesAt.get(current.to) ?? [];
  for (const candidate of leaving) {
    if (
      candidate.entityId !== current.entityId ||
      candidate.from !== current.to ||
      candidate.to !== current.from
    ) {
      return candidate;
    }
  }
  return undefined;
}

function assignLoopParents(loopGeometry: LoopGeometry[]): ProfileLoop[] {
  const sorted = [...loopGeometry].sort((a, b) => b.loop.area - a.loop.area);
  const parentById = new Map<string, string>();

  for (let i = 0; i < sorted.length; i += 1) {
    const inner = sorted[i]!;
    let bestParent: LoopGeometry | null = null;
    for (let j = 0; j < sorted.length; j += 1) {
      if (i === j) {
        continue;
      }
      const outer = sorted[j]!;
      if (outer.loop.area <= inner.loop.area) {
        continue;
      }
      if (!loopContainsLoop(outer, inner)) {
        continue;
      }
      if (bestParent === null || outer.loop.area < bestParent.loop.area) {
        bestParent = outer;
      }
    }
    if (bestParent !== null) {
      parentById.set(inner.loop.id, bestParent.loop.id);
    }
  }

  return loopGeometry.map((item) => ({
    ...item.loop,
    parentLoopId: parentById.get(item.loop.id),
  }));
}

function loopContainsLoop(outer: LoopGeometry, inner: LoopGeometry): boolean {
  if (outer.circle !== null && inner.circle !== null) {
    return circleContainsCircle(
      outer.circle.center,
      outer.circle.radius,
      inner.circle.center,
      inner.circle.radius,
    );
  }
  if (outer.vertices !== null && inner.circle !== null) {
    return polygonContainsCircle(
      outer.vertices,
      inner.circle.center,
      inner.circle.radius,
    );
  }
  if (outer.vertices !== null && inner.vertices !== null) {
    return pointInPolygon(inner.testPoint, outer.vertices);
  }
  if (outer.circle !== null && inner.vertices !== null) {
    return inner.vertices.every((vertex) =>
      circleContainsCircle(
        outer.circle!.center,
        outer.circle!.radius,
        vertex,
        0,
      ),
    );
  }
  return false;
}
