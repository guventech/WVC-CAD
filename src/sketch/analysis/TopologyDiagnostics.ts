import { listSolidProfileGeometry } from "./ProfileGeometry.ts";
import type { DiagnosticFinding } from "./DiagnosticTypes.ts";
import { pointsApproximatelyEqual, TOLERANCE } from "../geometry/GeometryMath.ts";
import { intersectLineSegments } from "../geometry/Intersections.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import type { EntityId, Geometry, LineGeometry } from "../model/Geometry.ts";

export interface TopologyAnalysis {
  readonly findings: DiagnosticFinding[];
  readonly openEndpointCount: number;
  readonly selfIntersectionCount: number;
  readonly closedLoopDetected: boolean;
  readonly nonManifoldCount: number;
}

export function analyzeSolidLineTopology(
  geometry: readonly Geometry[],
): TopologyAnalysis {
  const solids = listSolidProfileGeometry(geometry).filter(
    (entity): entity is LineGeometry => entity.type === "line",
  );
  const findings: DiagnosticFinding[] = [];
  let findingIndex = 0;
  const nextId = (code: string) => `top-${code}-${findingIndex++}`;

  const nodes: Point2D[] = [];
  const endpointNodes: {
    entityId: EntityId;
    end: "start" | "end";
    node: number;
  }[] = [];

  const nodeIndex = (point: Point2D): number => {
    for (let i = 0; i < nodes.length; i += 1) {
      if (pointsApproximatelyEqual(nodes[i]!, point, TOLERANCE.coincidence)) {
        return i;
      }
    }
    nodes.push(point);
    return nodes.length - 1;
  };

  for (const line of solids) {
    const start = nodeIndex(line.start);
    const end = nodeIndex(line.end);
    endpointNodes.push({ entityId: line.id, end: "start", node: start });
    endpointNodes.push({ entityId: line.id, end: "end", node: end });
  }

  const degree = new Array<number>(nodes.length).fill(0);
  for (const ep of endpointNodes) {
    degree[ep.node] += 1;
  }

  const openEndpoints = endpointNodes.filter((ep) => degree[ep.node] === 1);
  const openEndpointCount = openEndpoints.length;
  if (openEndpointCount > 0) {
    findings.push({
      id: nextId("open-endpoint"),
      severity: "warn",
      category: "geometry",
      code: "open-endpoint",
      message: `${openEndpointCount} open endpoint${openEndpointCount === 1 ? "" : "s"}`,
      entityIds: [...new Set(openEndpoints.map((ep) => ep.entityId))],
    });
  }

  const nonManifoldNodes = degree
    .map((d, index) => (d > 2 ? index : -1))
    .filter((index) => index >= 0);
  if (nonManifoldNodes.length > 0) {
    const entityIds = [
      ...new Set(
        endpointNodes
          .filter((ep) => nonManifoldNodes.includes(ep.node))
          .map((ep) => ep.entityId),
      ),
    ];
    findings.push({
      id: nextId("non-manifold"),
      severity: "warn",
      category: "profiles",
      code: "non-manifold",
      message: `${nonManifoldNodes.length} non-manifold junction${nonManifoldNodes.length === 1 ? "" : "s"}`,
      entityIds,
    });
  }

  const crossingEntityIds = new Set<EntityId>();
  let selfIntersectionCount = 0;
  for (let i = 0; i < solids.length; i += 1) {
    for (let j = i + 1; j < solids.length; j += 1) {
      const a = solids[i]!;
      const b = solids[j]!;
      const hit = intersectLineSegments(a.start, a.end, b.start, b.end);
      if (hit === null) {
        continue;
      }
      selfIntersectionCount += 1;
      crossingEntityIds.add(a.id);
      crossingEntityIds.add(b.id);
    }
  }
  if (selfIntersectionCount > 0) {
    findings.push({
      id: nextId("self-intersection"),
      severity: "error",
      category: "geometry",
      code: "self-intersection",
      message: `${selfIntersectionCount} self-intersection${selfIntersectionCount === 1 ? "" : "s"}`,
      entityIds: [...crossingEntityIds],
    });
  }

  const closedLoopDetected = detectSimpleClosedLineLoop(
    solids,
    nodes,
    degree,
    endpointNodes,
  );

  const constructionLines = geometry.filter(
    (entity): entity is LineGeometry =>
      entity.type === "line" && entity.construction,
  );
  const mixed: EntityId[] = [];
  for (const line of constructionLines) {
    for (const node of nodes) {
      if (
        pointsApproximatelyEqual(line.start, node, TOLERANCE.coincidence) ||
        pointsApproximatelyEqual(line.end, node, TOLERANCE.coincidence)
      ) {
        mixed.push(line.id);
        break;
      }
    }
  }
  if (mixed.length > 0) {
    findings.push({
      id: nextId("construction-in-profile"),
      severity: "warn",
      category: "profiles",
      code: "construction-in-profile",
      message: `${mixed.length} construction line${mixed.length === 1 ? "" : "s"} touch solid profile wire`,
      entityIds: mixed,
    });
  }

  return {
    findings,
    openEndpointCount,
    selfIntersectionCount,
    closedLoopDetected,
    nonManifoldCount: nonManifoldNodes.length,
  };
}

function detectSimpleClosedLineLoop(
  solids: readonly LineGeometry[],
  nodes: readonly Point2D[],
  degree: readonly number[],
  endpointNodes: readonly {
    readonly entityId: EntityId;
    readonly end: "start" | "end";
    readonly node: number;
  }[],
): boolean {
  if (solids.length < 3 || nodes.length === 0) {
    return false;
  }
  const used = new Set(endpointNodes.map((ep) => ep.node));
  for (const index of used) {
    if (degree[index] !== 2) {
      return false;
    }
  }
  const adj = new Map<number, number[]>();
  for (const line of solids) {
    const a = endpointNodes.find(
      (ep) => ep.entityId === line.id && ep.end === "start",
    )!.node;
    const b = endpointNodes.find(
      (ep) => ep.entityId === line.id && ep.end === "end",
    )!.node;
    const listA = adj.get(a) ?? [];
    listA.push(b);
    adj.set(a, listA);
    const listB = adj.get(b) ?? [];
    listB.push(a);
    adj.set(b, listB);
  }
  const start = used.values().next().value as number;
  const seen = new Set<number>();
  const stack = [start];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (seen.has(node)) {
      continue;
    }
    seen.add(node);
    for (const next of adj.get(node) ?? []) {
      stack.push(next);
    }
  }
  return seen.size === used.size;
}
