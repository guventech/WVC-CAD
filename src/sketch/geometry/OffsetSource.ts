import { analyzeProfiles } from "../analysis/ProfileAnalyzer.ts";
import type { EntityId, LineGeometry } from "../model/Geometry.ts";
import type { Sketch } from "../model/Sketch.ts";
import { pointOnCircle } from "./EntityFeatures.ts";
import { pointsApproximatelyEqual, TOLERANCE } from "./GeometryMath.ts";
import type { Point2D } from "./Point2D.ts";
import { orderedClosedLoopPolyline } from "./OffsetWire.ts";

export type OffsetSource =
  | {
      readonly kind: "segment";
      readonly start: Point2D;
      readonly end: Point2D;
    }
  | {
      readonly kind: "polyline";
      readonly vertices: readonly Point2D[];
      readonly closed: boolean;
      /** Seed edge used to interpret cursor side (left = positive). */
      readonly seedStart: Point2D;
      readonly seedEnd: Point2D;
    }
  | {
      readonly kind: "circle";
      readonly center: Point2D;
      readonly radius: number;
    };

/**
 * Resolve what the offset tool should copy when the user picks `entityId`.
 * Prefers a closed profile loop (lines and densified arcs), then an open
 * degree-2 line chain, else a single line segment or concentric circle.
 */
export function resolveOffsetSource(
  sketch: Sketch,
  entityId: EntityId,
): OffsetSource | null {
  const entity = sketch.geometry.find((item) => item.id === entityId);
  if (entity === undefined) {
    return null;
  }

  if (entity.type === "circle") {
    if (!(entity.radius > TOLERANCE.coincidence)) {
      return null;
    }
    return {
      kind: "circle",
      center: entity.center,
      radius: entity.radius,
    };
  }

  if (entity.type !== "line" && entity.type !== "arc") {
    return null;
  }

  const seedSegment = seedSegmentForEntity(entity);
  if (seedSegment === null) {
    return null;
  }

  const profiles = analyzeProfiles(sketch);
  const loop = profiles.loops.find(
    (item) => item.closed && item.entityIds.includes(entityId),
  );
  if (loop !== undefined) {
    const vertices = orderedClosedLoopPolyline(sketch, loop.entityIds);
    if (vertices !== null && vertices.length >= 3) {
      return {
        kind: "polyline",
        vertices,
        closed: true,
        seedStart: seedSegment.start,
        seedEnd: seedSegment.end,
      };
    }
  }

  // Open chains and lone segments: lines only (arcs need a closed loop).
  if (entity.type !== "line") {
    return null;
  }
  if (
    Math.hypot(entity.end.x - entity.start.x, entity.end.y - entity.start.y) <=
    TOLERANCE.coincidence
  ) {
    return null;
  }

  const chain = walkOpenLineChain(sketch, entity);
  if (chain !== null && chain.vertices.length >= 3) {
    return {
      kind: "polyline",
      vertices: chain.vertices,
      closed: false,
      seedStart: entity.start,
      seedEnd: entity.end,
    };
  }

  return {
    kind: "segment",
    start: entity.start,
    end: entity.end,
  };
}

function seedSegmentForEntity(
  entity: Extract<
    Sketch["geometry"][number],
    { type: "line" } | { type: "arc" }
  >,
): { readonly start: Point2D; readonly end: Point2D } | null {
  if (entity.type === "line") {
    if (
      Math.hypot(entity.end.x - entity.start.x, entity.end.y - entity.start.y) <=
      TOLERANCE.coincidence
    ) {
      return null;
    }
    return { start: entity.start, end: entity.end };
  }
  if (!(entity.radius > TOLERANCE.coincidence)) {
    return null;
  }
  // Chord of the arc for signed-distance side (same as a short tangent proxy).
  const start = pointOnCircle(entity.center, entity.radius, entity.startAngle);
  const end = pointOnCircle(entity.center, entity.radius, entity.endAngle);
  if (
    Math.hypot(end.x - start.x, end.y - start.y) <= TOLERANCE.coincidence
  ) {
    // Near-full circle chord collapses — use a short tangent at startAngle.
    const tx = -Math.sin(entity.startAngle);
    const ty = Math.cos(entity.startAngle);
    return {
      start,
      end: { x: start.x + tx, y: start.y + ty },
    };
  }
  return { start, end };
}

function walkOpenLineChain(
  sketch: Sketch,
  seed: LineGeometry,
): { readonly vertices: Point2D[] } | null {
  const lines = sketch.geometry.filter(
    (g): g is LineGeometry =>
      g.type === "line" &&
      !g.construction &&
      Math.hypot(g.end.x - g.start.x, g.end.y - g.start.y) > TOLERANCE.coincidence,
  );

  type NodeKey = string;
  const keyOf = (p: Point2D): NodeKey =>
    `${p.x.toFixed(6)},${p.y.toFixed(6)}`;

  const nodeLines = new Map<NodeKey, LineGeometry[]>();
  const pointAt = new Map<NodeKey, Point2D>();
  for (const line of lines) {
    for (const p of [line.start, line.end]) {
      const key = keyOf(p);
      pointAt.set(key, p);
      const list = nodeLines.get(key) ?? [];
      list.push(line);
      nodeLines.set(key, list);
    }
  }

  // Non-manifold junctions abort chain growth (keep single-segment offset).
  for (const list of nodeLines.values()) {
    if (list.length > 2) {
      const touchesSeed = list.some((line) => line.id === seed.id);
      if (touchesSeed) {
        return null;
      }
    }
  }

  const used = new Set<EntityId>([seed.id]);
  const forward = extendChain(seed.end, seed, used, nodeLines, keyOf);
  const backward = extendChain(seed.start, seed, used, nodeLines, keyOf);

  const vertices: Point2D[] = [
    ...backward.reverse(),
    seed.start,
    seed.end,
    ...forward,
  ];
  // Deduplicate accidental repeats
  const compact: Point2D[] = [vertices[0]!];
  for (let i = 1; i < vertices.length; i += 1) {
    if (
      !pointsApproximatelyEqual(
        vertices[i]!,
        compact[compact.length - 1]!,
        TOLERANCE.coincidence,
      )
    ) {
      compact.push(vertices[i]!);
    }
  }
  return compact.length >= 3 ? { vertices: compact } : null;
}

function extendChain(
  from: Point2D,
  via: LineGeometry,
  used: Set<EntityId>,
  nodeLines: Map<string, LineGeometry[]>,
  keyOf: (p: Point2D) => string,
): Point2D[] {
  const out: Point2D[] = [];
  let tip = from;
  let previous = via;
  for (;;) {
    const atNode = nodeLines.get(keyOf(tip)) ?? [];
    const next = atNode.find(
      (line) => line.id !== previous.id && !used.has(line.id),
    );
    if (next === undefined || atNode.length !== 2) {
      break;
    }
    used.add(next.id);
    const nextTip = pointsApproximatelyEqual(
      next.start,
      tip,
      TOLERANCE.coincidence,
    )
      ? next.end
      : next.start;
    out.push(nextTip);
    tip = nextTip;
    previous = next;
  }
  return out;
}
