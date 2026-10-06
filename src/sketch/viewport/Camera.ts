import type { Point2D } from "../geometry/Point2D.ts";

/**
 * View transform only.
 * Does not modify sketch geometry.
 *
 * `scale` is screen pixels per millimetre.
 * `originScreenX` / `originScreenY` are the screen position of world (0, 0).
 * World X increases to the right. World Y increases upward, so screen Y is flipped.
 */
export interface Camera {
  readonly scale: number;
  readonly originScreenX: number;
  readonly originScreenY: number;
}

export const DEFAULT_CAMERA_SCALE = 2;

export const MIN_CAMERA_SCALE = 0.02;
export const MAX_CAMERA_SCALE = 500;

export function createCamera(
  viewportWidth: number,
  viewportHeight: number,
  scale: number = DEFAULT_CAMERA_SCALE,
): Camera {
  return {
    scale,
    originScreenX: viewportWidth / 2,
    originScreenY: viewportHeight / 2,
  };
}

export function worldToScreen(point: Point2D, camera: Camera): Point2D {
  return {
    x: point.x * camera.scale + camera.originScreenX,
    y: -point.y * camera.scale + camera.originScreenY,
  };
}

export function screenToWorld(point: Point2D, camera: Camera): Point2D {
  return {
    x: (point.x - camera.originScreenX) / camera.scale,
    y: -(point.y - camera.originScreenY) / camera.scale,
  };
}

export function panCamera(camera: Camera, screenDeltaX: number, screenDeltaY: number): Camera {
  return {
    ...camera,
    originScreenX: camera.originScreenX + screenDeltaX,
    originScreenY: camera.originScreenY + screenDeltaY,
  };
}

export function clampCameraScale(scale: number): number {
  return Math.min(MAX_CAMERA_SCALE, Math.max(MIN_CAMERA_SCALE, scale));
}

/**
 * Zoom so the world point under `screenPoint` stays under that screen point.
 */
export function zoomCameraAt(
  camera: Camera,
  screenPoint: Point2D,
  scaleFactor: number,
): Camera {
  const worldPoint = screenToWorld(screenPoint, camera);
  const nextScale = clampCameraScale(camera.scale * scaleFactor);

  return {
    scale: nextScale,
    originScreenX: screenPoint.x - worldPoint.x * nextScale,
    originScreenY: screenPoint.y + worldPoint.y * nextScale,
  };
}
