import type { Point2D } from "./Point2D.ts";
import type { Geometry } from "../model/Geometry.ts";

export type FeatureKind =
  | "point"
  | "endpoint-start"
  | "endpoint-end"
  | "midpoint"
  | "center";

export interface EntityFeature {
  readonly kind: FeatureKind;
  readonly point: Point2D;
  readonly label: string;
}

export function pointOnCircle(
  center: Point2D,
  radius: number,
  angleRadians: number,
): Point2D {
  return {
    x: center.x + radius * Math.cos(angleRadians),
    y: center.y + radius * Math.sin(angleRadians),
  };
}

export function lineMidpoint(start: Point2D, end: Point2D): Point2D {
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
}

/** Features used for snap and hit priority (points, endpoints, midpoints, centers). */
export function listEntityFeatures(entity: Geometry): readonly EntityFeature[] {
  switch (entity.type) {
    case "point":
      return [
        {
          kind: "point",
          point: entity.position,
          label: "Point",
        },
      ];
    case "line":
      return [
        {
          kind: "endpoint-start",
          point: entity.start,
          label: "Endpoint",
        },
        {
          kind: "endpoint-end",
          point: entity.end,
          label: "Endpoint",
        },
        {
          kind: "midpoint",
          point: lineMidpoint(entity.start, entity.end),
          label: "Midpoint",
        },
      ];
    case "circle":
      return [
        {
          kind: "center",
          point: entity.center,
          label: "Center",
        },
      ];
    case "arc":
      return [
        {
          kind: "center",
          point: entity.center,
          label: "Center",
        },
        {
          kind: "endpoint-start",
          point: pointOnCircle(entity.center, entity.radius, entity.startAngle),
          label: "Endpoint",
        },
        {
          kind: "endpoint-end",
          point: pointOnCircle(entity.center, entity.radius, entity.endAngle),
          label: "Endpoint",
        },
      ];
  }
}

/**
 * Snap targets for the inference engine (Chunk 9).
 * Includes endpoints, points, midpoints, and centers.
 */
export function listSnapFeatures(entity: Geometry): readonly EntityFeature[] {
  return listEntityFeatures(entity);
}

/** Selection handles drawn for a selected entity (editable grips, not all snap sites). */
export function listHandlePoints(entity: Geometry): readonly Point2D[] {
  switch (entity.type) {
    case "point":
      return [entity.position];
    case "line":
      return [entity.start, entity.end];
    case "circle":
      return [entity.center];
    case "arc": {
      const features = listEntityFeatures(entity);
      return features.map((feature) => feature.point);
    }
  }
}
