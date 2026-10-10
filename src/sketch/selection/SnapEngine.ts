import { distance, projectPointOntoLine } from "../geometry/GeometryMath.ts";
import {
  listSnapFeatures,
  type FeatureKind,
} from "../geometry/EntityFeatures.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import type { EntityId, Geometry } from "../model/Geometry.ts";
import {
  datumDisplayName,
  resolveFrameAxisLine,
  resolveFrameOrigin,
  type SketchFrame,
} from "../model/SketchFrame.ts";
import type { Camera } from "../viewport/Camera.ts";
import { collectIntersectionCandidates } from "./intersectionSnap.ts";
import { collectOnEntityCandidate } from "./onEntitySnap.ts";
import type { SnapCandidate } from "./SnapTypes.ts";

export type { SnapCandidate, SnapType } from "./SnapTypes.ts";

export const SNAP_TOLERANCE_PX = 8;

const PRIORITY = {
  origin: 100,
  endpoint: 90,
  point: 90,
  midpoint: 85,
  center: 80,
  /** H/V locked to alignTo and free axis on a grid line. */
  horizontalGrid: 75,
  verticalGrid: 75,
  horizontal: 70,
  vertical: 70,
  /** Project onto world X/Y — below H/V inference, above grid. */
  axis: 55,
  grid: 40,
} as const;

export interface SnapOptions {
  readonly camera: Camera;
  readonly gridSpacingMm: number;
  readonly tolerancePx?: number;
  readonly excludeEntityIds?: readonly EntityId[];
  /** World datum frame; defaults to origin-only when omitted. */
  readonly frame?: SketchFrame;
  /**
   * When set (line/circle/arc placement), add temporary horizontal/vertical
   * inference candidates relative to this point. Does not create constraints.
   */
  readonly alignTo?: Point2D;
}

/**
 * Pick the best snap near `worldPoint`.
 * Tolerance is screen-space so zoom does not change snap feel.
 */
export function findSnap(
  worldPoint: Point2D,
  geometry: readonly Geometry[],
  options: SnapOptions,
): SnapCandidate | null {
  const candidates = collectSnapCandidates(worldPoint, geometry, options);
  if (candidates.length === 0) {
    return null;
  }

  const tolerancePx = options.tolerancePx ?? SNAP_TOLERANCE_PX;
  const scale = options.camera.scale;

  let best: SnapCandidate | null = null;
  let bestDistancePx = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const distancePx = distance(worldPoint, candidate.point) * scale;
    if (distancePx > tolerancePx) {
      continue;
    }
    if (
      best === null ||
      candidate.priority > best.priority ||
      (candidate.priority === best.priority && distancePx < bestDistancePx)
    ) {
      best = candidate;
      bestDistancePx = distancePx;
    }
  }

  return best;
}

export function collectSnapCandidates(
  worldPoint: Point2D,
  geometry: readonly Geometry[],
  options: SnapOptions,
): SnapCandidate[] {
  const exclude = new Set(options.excludeEntityIds ?? []);
  const origin = options.frame
    ? resolveFrameOrigin(options.frame)
    : { x: 0, y: 0 };
  const candidates: SnapCandidate[] = [
    {
      type: "origin",
      point: origin,
      sourceEntityId: options.frame?.originId,
      priority: PRIORITY.origin,
      label: "Origin",
    },
    createGridCandidate(worldPoint, options.gridSpacingMm),
  ];

  if (options.frame !== undefined) {
    for (const axis of options.frame.axes) {
      const line = resolveFrameAxisLine(options.frame, axis.id);
      if (line === null) {
        continue;
      }
      const projected = projectPointOntoLine(worldPoint, line.start, line.end);
      candidates.push({
        type: "axis",
        point: projected,
        sourceEntityId: axis.id,
        priority: PRIORITY.axis,
        label: datumDisplayName(options.frame, axis.id) ?? "Axis",
      });
    }
  }

  if (options.alignTo !== undefined) {
    const spacing = options.gridSpacingMm > 0 ? options.gridSpacingMm : 10;
    const gridX = Math.round(worldPoint.x / spacing) * spacing;
    const gridY = Math.round(worldPoint.y / spacing) * spacing;

    candidates.push(
      {
        type: "horizontal",
        point: { x: worldPoint.x, y: options.alignTo.y },
        priority: PRIORITY.horizontal,
        label: "Horizontal",
      },
      {
        type: "horizontal",
        point: { x: gridX, y: options.alignTo.y },
        priority: PRIORITY.horizontalGrid,
        label: `Horizontal · Grid ${spacing} mm`,
      },
      {
        type: "vertical",
        point: { x: options.alignTo.x, y: worldPoint.y },
        priority: PRIORITY.vertical,
        label: "Vertical",
      },
      {
        type: "vertical",
        point: { x: options.alignTo.x, y: gridY },
        priority: PRIORITY.verticalGrid,
        label: `Vertical · Grid ${spacing} mm`,
      },
    );
  }

  const toleranceWorld =
    (options.tolerancePx ?? SNAP_TOLERANCE_PX) / options.camera.scale;

  for (const entity of geometry) {
    if (exclude.has(entity.id)) {
      continue;
    }
    for (const feature of listSnapFeatures(entity)) {
      candidates.push(
        candidateFromFeature(entity.id, feature.kind, feature.point, feature.label),
      );
    }
    const onEntity = collectOnEntityCandidate(entity, worldPoint, toleranceWorld);
    if (onEntity !== null) {
      candidates.push(onEntity);
    }
  }

  candidates.push(...collectIntersectionCandidates(geometry, exclude));

  return candidates;
}

function candidateFromFeature(
  entityId: EntityId,
  kind: FeatureKind,
  point: Point2D,
  label: string,
): SnapCandidate {
  switch (kind) {
    case "midpoint":
      return {
        type: "midpoint",
        point,
        sourceEntityId: entityId,
        priority: PRIORITY.midpoint,
        label,
      };
    case "center":
      return {
        type: "center",
        point,
        sourceEntityId: entityId,
        priority: PRIORITY.center,
        label,
      };
    case "point":
      return {
        type: "point",
        point,
        sourceEntityId: entityId,
        priority: PRIORITY.point,
        label,
      };
    default:
      return {
        type: "endpoint",
        point,
        sourceEntityId: entityId,
        priority: PRIORITY.endpoint,
        label,
      };
  }
}

function createGridCandidate(
  worldPoint: Point2D,
  gridSpacingMm: number,
): SnapCandidate {
  const spacing = gridSpacingMm > 0 ? gridSpacingMm : 10;
  return {
    type: "grid",
    point: {
      x: Math.round(worldPoint.x / spacing) * spacing,
      y: Math.round(worldPoint.y / spacing) * spacing,
    },
    priority: PRIORITY.grid,
    label: `Grid ${spacing} mm`,
  };
}
