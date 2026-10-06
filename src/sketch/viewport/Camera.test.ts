import { describe, expect, it } from "vitest";
import { isApproximatelyEqual, TOLERANCE } from "../geometry/GeometryMath.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import {
  createCamera,
  panCamera,
  screenToWorld,
  worldToScreen,
  zoomCameraAt,
  type Camera,
} from "./Camera.ts";

function expectPointClose(
  actual: Point2D,
  expected: Point2D,
  tolerance: number = TOLERANCE.display,
): void {
  expect(isApproximatelyEqual(actual.x, expected.x, tolerance)).toBe(true);
  expect(isApproximatelyEqual(actual.y, expected.y, tolerance)).toBe(true);
}

describe("Camera", () => {
  it("maps world origin to the configured screen origin", () => {
    const camera = createCamera(800, 600);

    expect(worldToScreen({ x: 0, y: 0 }, camera)).toEqual({
      x: 400,
      y: 300,
    });
  });

  it("keeps world X rightward and world Y upward on screen", () => {
    const camera: Camera = {
      scale: 2,
      originScreenX: 100,
      originScreenY: 200,
    };

    expect(worldToScreen({ x: 10, y: 0 }, camera)).toEqual({ x: 120, y: 200 });
    expect(worldToScreen({ x: 0, y: 10 }, camera)).toEqual({ x: 100, y: 180 });
  });

  it("round-trips world → screen → world", () => {
    const camera = createCamera(1024, 768, 3.5);
    const samples: Point2D[] = [
      { x: 0, y: 0 },
      { x: 25.4, y: -12.7 },
      { x: -100, y: 50 },
      { x: 0.001, y: 0.001 },
    ];

    for (const point of samples) {
      const screen = worldToScreen(point, camera);
      const world = screenToWorld(screen, camera);
      expectPointClose(world, point, TOLERANCE.geometric * 100);
    }
  });

  it("does not change world coordinates when panning", () => {
    const camera = createCamera(800, 600, 2);
    const worldPoint = { x: 30, y: 40 };
    const screenBefore = worldToScreen(worldPoint, camera);
    const panned = panCamera(camera, 55, -20);

    expectPointClose(screenToWorld(screenBefore, camera), worldPoint);
    expectPointClose(
      screenToWorld(
        {
          x: screenBefore.x + 55,
          y: screenBefore.y - 20,
        },
        panned,
      ),
      worldPoint,
    );
  });

  it("zooms around the cursor without moving the world point under it", () => {
    const camera = createCamera(800, 600, 2);
    const cursor = { x: 220, y: 140 };
    const worldUnderCursor = screenToWorld(cursor, camera);

    const zoomedIn = zoomCameraAt(camera, cursor, 2);
    expectPointClose(screenToWorld(cursor, zoomedIn), worldUnderCursor);

    const zoomedOut = zoomCameraAt(zoomedIn, cursor, 0.5);
    expectPointClose(screenToWorld(cursor, zoomedOut), worldUnderCursor);
  });

  it("keeps axes perpendicular after pan and zoom", () => {
    const camera = zoomCameraAt(
      panCamera(createCamera(800, 600, 2), 40, -15),
      { x: 100, y: 100 },
      1.75,
    );

    const origin = worldToScreen({ x: 0, y: 0 }, camera);
    const xPoint = worldToScreen({ x: 10, y: 0 }, camera);
    const yPoint = worldToScreen({ x: 0, y: 10 }, camera);

    const xVector = { x: xPoint.x - origin.x, y: xPoint.y - origin.y };
    const yVector = { x: yPoint.x - origin.x, y: yPoint.y - origin.y };
    const dot = xVector.x * yVector.x + xVector.y * yVector.y;

    expect(isApproximatelyEqual(dot, 0, TOLERANCE.display)).toBe(true);
    expect(xVector.y).toBe(0);
    expect(yVector.x).toBe(0);
    expect(xVector.x).toBeGreaterThan(0);
    expect(yVector.y).toBeLessThan(0);
  });
});
