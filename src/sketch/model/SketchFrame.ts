import type { Point2D } from "../geometry/Point2D.ts";
import { WORLD_ORIGIN } from "./CoordinateSystem.ts";
import type { EntityId } from "./Geometry.ts";

/**
 * Axis tags for the sketch frame.
 * `"z"` is reserved for a future Frame3D / out-of-plane datum — 2D sketches
 * instantiate only in-plane `"x"` / `"y"`. Plane binding lives on `SketchPlane`.
 */
export type FrameAxisTag = "x" | "y" | "z";

/** Stable datum ids — never appear in `sketch.geometry`. */
export const DATUM_ORIGIN_ID: EntityId = "datum:origin";
export const DATUM_AXIS_X_ID: EntityId = "datum:axis:x";
export const DATUM_AXIS_Y_ID: EntityId = "datum:axis:y";

export const DEFAULT_FRAME_ID = "frame-world";

export interface FrameAxis {
  readonly id: EntityId;
  readonly tag: FrameAxisTag;
  /** Unit direction in the sketch plane (2D). */
  readonly direction: Point2D;
}

/** Point in millimetres in a right-handed world 3D frame (future Pad host). */
export interface Point3D {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Model-only sketch-plane binding for a future Pad / host solid.
 * UI and solver stay 2D; this records where the sketch plane sits in 3D.
 * Only the default world XY plane (origin 0, normal +Z) is accepted today.
 */
export interface SketchPlane {
  /** Always `"world-xy"` until additional host planes exist. */
  readonly kind: "world-xy";
  /** Sketch origin mapped into world 3D. */
  readonly origin: Point3D;
  /** Unit normal of the sketch plane (out of the page for default 2D). */
  readonly normal: Point3D;
}

export const DEFAULT_SKETCH_PLANE: SketchPlane = {
  kind: "world-xy",
  origin: { x: 0, y: 0, z: 0 },
  normal: { x: 0, y: 0, z: 1 },
};

/**
 * Fixed world/sketch datum frame: origin + in-plane axes + optional 3D plane.
 * Datums are selectable and constrainable but never solver variables.
 */
export interface SketchFrame {
  readonly id: string;
  readonly originId: EntityId;
  readonly axes: readonly FrameAxis[];
  /** 3D plane attachment (default world XY). Omitted on disk → default on load. */
  readonly plane: SketchPlane;
}

/** Default 2D world frame: origin (0,0), +X right, +Y up, plane normal +Z. */
export function createDefaultSketchFrame(): SketchFrame {
  return {
    id: DEFAULT_FRAME_ID,
    originId: DATUM_ORIGIN_ID,
    axes: [
      { id: DATUM_AXIS_X_ID, tag: "x", direction: { x: 1, y: 0 } },
      { id: DATUM_AXIS_Y_ID, tag: "y", direction: { x: 0, y: 1 } },
    ],
    plane: {
      kind: DEFAULT_SKETCH_PLANE.kind,
      origin: { ...DEFAULT_SKETCH_PLANE.origin },
      normal: { ...DEFAULT_SKETCH_PLANE.normal },
    },
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
    case "z":
      return "Z axis";
  }
}

export function isDefaultSketchPlane(plane: SketchPlane): boolean {
  return (
    plane.kind === "world-xy" &&
    plane.origin.x === 0 &&
    plane.origin.y === 0 &&
    plane.origin.z === 0 &&
    plane.normal.x === 0 &&
    plane.normal.y === 0 &&
    plane.normal.z === 1
  );
}
