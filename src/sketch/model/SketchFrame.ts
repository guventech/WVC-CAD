import type { Point2D } from "../geometry/Point2D.ts";
import { WORLD_ORIGIN } from "./CoordinateSystem.ts";
import type { EntityId } from "./Geometry.ts";

/**
 * Axis tags for the sketch frame (in-plane X/Y).
 */
export type FrameAxisTag = "x" | "y";

/** Stable datum ids — never appear in `sketch.geometry`. */
export const DATUM_ORIGIN_ID: EntityId = "datum:origin";
export const DATUM_AXIS_X_ID: EntityId = "datum:axis:x";
export const DATUM_AXIS_Y_ID: EntityId = "datum:axis:y";

export const DEFAULT_FRAME_ID = "frame-world";

export interface FrameAxis {
  readonly id: EntityId;
  readonly tag: FrameAxisTag;
  /** Unit direction in the sketch plane. */
  readonly direction: Point2D;
}

/**
 * Fixed world/sketch datum frame: origin + in-plane axes.
 * Datums are selectable and constrainable but never solver variables.
 */
export interface SketchFrame {
  readonly id: string;
  readonly originId: EntityId;
  readonly axes: readonly FrameAxis[];
}

/** Default 2D world frame: origin (0,0), +X right, +Y up. */
export function createDefaultSketchFrame(): SketchFrame {
  return {
    id: DEFAULT_FRAME_ID,
    originId: DATUM_ORIGIN_ID,
    axes: [
      { id: DATUM_AXIS_X_ID, tag: "x", direction: { x: 1, y: 0 } },
      { id: DATUM_AXIS_Y_ID, tag: "y", direction: { x: 0, y: 1 } },
    ],
  };
}

export function listDatumIds(frame: SketchFrame): EntityId[] {
  return [frame.originId, ...frame.axes.map((axis) => axis.id)];
}

export function isDatumId(frame: SketchFrame, entityId: EntityId): boolean {
  if (entityId === frame.originId) {
    return true;
  }
  return frame.axes.some((axis) => axis.id === entityId);
}

export function isDatumOriginId(frame: SketchFrame, entityId: EntityId): boolean {
  return entityId === frame.originId;
}

export function findFrameAxis(
  frame: SketchFrame,
  entityId: EntityId,
): FrameAxis | null {
  return frame.axes.find((axis) => axis.id === entityId) ?? null;
}

/** World position of the frame origin (always (0,0) for the default frame). */
export function resolveFrameOrigin(_frame: SketchFrame): Point2D {
  return { x: WORLD_ORIGIN.x, y: WORLD_ORIGIN.y };
}

/**
 * Two points defining the infinite axis line for projection / residuals.
 * Uses origin and origin + direction (unit length).
 */
export function resolveFrameAxisLine(
  frame: SketchFrame,
  axisId: EntityId,
): { readonly start: Point2D; readonly end: Point2D } | null {
  const axis = findFrameAxis(frame, axisId);
  if (axis === null) {
    return null;
  }
  const origin = resolveFrameOrigin(frame);
  return {
    start: origin,
    end: {
      x: origin.x + axis.direction.x,
      y: origin.y + axis.direction.y,
    },
  };
}

export function datumDisplayName(
  frame: SketchFrame,
  entityId: EntityId,
): string | null {
  if (entityId === frame.originId) {
    return "Origin";
  }
  const axis = findFrameAxis(frame, entityId);
  if (axis === null) {
    return null;
  }
  switch (axis.tag) {
    case "x":
      return "X axis";
    case "y":
      return "Y axis";
  }
}
