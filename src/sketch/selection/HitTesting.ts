import {
  angleFromTo,
  distance,
  distancePointToSegment,
  isAngleInArcSweep,
  projectPointOntoLine,
} from "../geometry/GeometryMath.ts";
import { pointOnCircle } from "../geometry/EntityFeatures.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import type { EntityId, Geometry } from "../model/Geometry.ts";
import {
  resolveFrameAxisLine,
  resolveFrameOrigin,
  type SketchFrame,
} from "../model/SketchFrame.ts";
import type { Sketch } from "../model/Sketch.ts";
import type { Camera } from "../viewport/Camera.ts";

/** Click / hover tolerance in screen pixels. Independent of zoom. */
export const HIT_TOLERANCE_PX = 6;

export type HitPart =
  | "point"
  | "endpoint-start"
  | "endpoint-end"
  | "center"
  | "edge";

export interface HitResult {
  readonly entityId: EntityId;
  readonly part: HitPart;
  /** Screen-space distance from the cursor to the hit feature, in pixels. */
  readonly distancePx: number;
  readonly priority: number;
}

const PRIORITY = {
  endpoint: 100,
  center: 80,
  /**
   * Frame origin matches free-point priority; when a geometry point sits on
   * the origin, compareHits prefers the geometry entity.
   */
  origin: 70,
  point: 70,
  edge: 40,
  /**
   * Frame axes below geometry edges so entities lying on an axis remain
   * editable; empty-axis clicks still pick the datum.
   */
  axis: 35,
} as const;

export interface HitTestOptions {
  readonly camera: Camera;
  readonly tolerancePx?: number;
}

/**
 * Pick the best hit under `worldPoint` (geometry only).
 * Prefer {@link hitTestSketch} when the world frame should participate.
 */
export function hitTest(
  geometry: readonly Geometry[],
  worldPoint: Point2D,
  options: HitTestOptions,
): HitResult | null {
  const hits = hitTestAll(geometry, worldPoint, options);
  return hits[0] ?? null;
}

export function hitTestAll(
  geometry: readonly Geometry[],
  worldPoint: Point2D,
  options: HitTestOptions,
): HitResult[] {
  const tolerancePx = options.tolerancePx ?? HIT_TOLERANCE_PX;
  const scale = options.camera.scale;
  const toleranceWorld = tolerancePx / scale;
  const hits: HitResult[] = [];

  for (const entity of geometry) {
    hits.push(...collectEntityHits(entity, worldPoint, scale, toleranceWorld));
  }

  hits.sort(compareHits);
  return hits;
}

/** Geometry + fixed world-frame datums. */
export function hitTestSketch(
  sketch: Sketch,
  worldPoint: Point2D,
  options: HitTestOptions,
): HitResult | null {
  const hits = hitTestSketchAll(sketch, worldPoint, options);
  return hits[0] ?? null;
}

export function hitTestSketchAll(
  sketch: Sketch,
  worldPoint: Point2D,
  options: HitTestOptions,
): HitResult[] {
  const tolerancePx = options.tolerancePx ?? HIT_TOLERANCE_PX;
  const scale = options.camera.scale;
  const toleranceWorld = tolerancePx / scale;
  const hits: HitResult[] = [
    ...hitTestDatums(sketch.frame, worldPoint, scale, toleranceWorld),
  ];
  for (const entity of sketch.geometry) {
    hits.push(...collectEntityHits(entity, worldPoint, scale, toleranceWorld));
  }
  hits.sort(compareHits);
  return hits;
}

export function hitTestDatums(
  frame: SketchFrame,
  worldPoint: Point2D,
  scale: number,
  toleranceWorld: number,
): HitResult[] {
  const hits: HitResult[] = [];
  const origin = resolveFrameOrigin(frame);
  const originDist = distance(worldPoint, origin);
  if (originDist <= toleranceWorld) {
    hits.push({
      entityId: frame.originId,
      part: "point",
      distancePx: originDist * scale,
      priority: PRIORITY.origin,
    });
  }

  for (const axis of frame.axes) {
    const line = resolveFrameAxisLine(frame, axis.id);
    if (line === null) {
      continue;
    }
    const projected = projectPointOntoLine(worldPoint, line.start, line.end);
    const axisDist = distance(worldPoint, projected);
    if (axisDist <= toleranceWorld) {
      hits.push({
        entityId: axis.id,
        part: "edge",
        distancePx: axisDist * scale,
        priority: PRIORITY.axis,
      });
    }
  }

  return hits;
}

function collectEntityHits(
  entity: Geometry,
  worldPoint: Point2D,
  scale: number,
  toleranceWorld: number,
): HitResult[] {
  switch (entity.type) {
    case "point":
      return collectPointHits(entity.id, entity.position, worldPoint, scale, toleranceWorld);
    case "line":
      return collectLineHits(entity, worldPoint, scale, toleranceWorld);
    case "circle":
      return collectCircleHits(entity, worldPoint, scale, toleranceWorld);
    case "arc":
      return collectArcHits(entity, worldPoint, scale, toleranceWorld);
  }
}

function collectPointHits(
  entityId: EntityId,
  position: Point2D,
  worldPoint: Point2D,
  scale: number,
  toleranceWorld: number,
): HitResult[] {
  const dist = distance(worldPoint, position);
  if (dist > toleranceWorld) {
    return [];
  }
  return [
    {
      entityId,
      part: "point",
      distancePx: dist * scale,
      priority: PRIORITY.point,
    },
  ];
}

function collectLineHits(
  entity: Extract<Geometry, { type: "line" }>,
  worldPoint: Point2D,
  scale: number,
  toleranceWorld: number,
): HitResult[] {
  const hits: HitResult[] = [];

  const startDist = distance(worldPoint, entity.start);
  if (startDist <= toleranceWorld) {
    hits.push({
      entityId: entity.id,
      part: "endpoint-start",
      distancePx: startDist * scale,
      priority: PRIORITY.endpoint,
    });
  }

  const endDist = distance(worldPoint, entity.end);
  if (endDist <= toleranceWorld) {
    hits.push({
      entityId: entity.id,
      part: "endpoint-end",
      distancePx: endDist * scale,
      priority: PRIORITY.endpoint,
    });
  }

  const edgeDist = distancePointToSegment(worldPoint, entity.start, entity.end);
  if (edgeDist <= toleranceWorld) {
    hits.push({
      entityId: entity.id,
      part: "edge",
      distancePx: edgeDist * scale,
      priority: PRIORITY.edge,
    });
  }

  return hits;
}

function collectCircleHits(
  entity: Extract<Geometry, { type: "circle" }>,
  worldPoint: Point2D,
  scale: number,
  toleranceWorld: number,
): HitResult[] {
  const hits: HitResult[] = [];
  const centerDist = distance(worldPoint, entity.center);

  if (centerDist <= toleranceWorld) {
    hits.push({
      entityId: entity.id,
      part: "center",
      distancePx: centerDist * scale,
      priority: PRIORITY.center,
    });
  }

  const edgeDist = Math.abs(centerDist - entity.radius);
  if (edgeDist <= toleranceWorld) {
    hits.push({
      entityId: entity.id,
      part: "edge",
      distancePx: edgeDist * scale,
      priority: PRIORITY.edge,
    });
  }

  return hits;
}

function collectArcHits(
  entity: Extract<Geometry, { type: "arc" }>,
  worldPoint: Point2D,
  scale: number,
  toleranceWorld: number,
): HitResult[] {
  const hits: HitResult[] = [];
  const startPoint = pointOnCircle(entity.center, entity.radius, entity.startAngle);
  const endPoint = pointOnCircle(entity.center, entity.radius, entity.endAngle);

  const startDist = distance(worldPoint, startPoint);
  if (startDist <= toleranceWorld) {
    hits.push({
      entityId: entity.id,
      part: "endpoint-start",
      distancePx: startDist * scale,
      priority: PRIORITY.endpoint,
    });
  }

  const endDist = distance(worldPoint, endPoint);
  if (endDist <= toleranceWorld) {
    hits.push({
      entityId: entity.id,
      part: "endpoint-end",
      distancePx: endDist * scale,
      priority: PRIORITY.endpoint,
    });
  }

  const centerDist = distance(worldPoint, entity.center);
  if (centerDist <= toleranceWorld) {
    hits.push({
      entityId: entity.id,
      part: "center",
      distancePx: centerDist * scale,
      priority: PRIORITY.center,
    });
  }

  const edgeDist = Math.abs(centerDist - entity.radius);
  const angle = angleFromTo(entity.center, worldPoint);
  if (edgeDist <= toleranceWorld && isAngleInArcSweep(angle, entity.startAngle, entity.endAngle)) {
    hits.push({
      entityId: entity.id,
      part: "edge",
      distancePx: edgeDist * scale,
      priority: PRIORITY.edge,
    });
  }

  return hits;
}

function compareHits(a: HitResult, b: HitResult): number {
  if (a.priority !== b.priority) {
    return b.priority - a.priority;
  }
  if (a.distancePx !== b.distancePx) {
    return a.distancePx - b.distancePx;
  }
  // Prefer user geometry over frame datums when otherwise tied (e.g. endpoint at origin).
  const aDatum = a.entityId.startsWith("datum:");
  const bDatum = b.entityId.startsWith("datum:");
  if (aDatum !== bDatum) {
    return aDatum ? 1 : -1;
  }
  return a.entityId.localeCompare(b.entityId);
}
