import type { Point2D } from "../geometry/Point2D.ts";

/** World origin. X increases to the right. Y increases upward. Units are millimetres. */
export const WORLD_ORIGIN: Point2D = { x: 0, y: 0 };

export const WORLD_AXIS = {
  x: "right",
  y: "up",
} as const;
