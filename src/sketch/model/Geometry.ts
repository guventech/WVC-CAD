import type { Point2D } from "../geometry/Point2D.ts";

export type EntityId = string;

export interface PointGeometry {
  readonly id: EntityId;
  readonly type: "point";
  readonly position: Point2D;
  readonly construction: boolean;
}

export interface LineGeometry {
  readonly id: EntityId;
  readonly type: "line";
  readonly start: Point2D;
  readonly end: Point2D;
  readonly construction: boolean;
}

export interface CircleGeometry {
  readonly id: EntityId;
  readonly type: "circle";
  readonly center: Point2D;
  readonly radius: number;
  readonly construction: boolean;
}

export interface ArcGeometry {
  readonly id: EntityId;
  readonly type: "arc";
  readonly center: Point2D;
  readonly radius: number;
  /** Radians from +X, increasing counterclockwise. */
  readonly startAngle: number;
  /** Radians from +X, increasing counterclockwise. */
  readonly endAngle: number;
  readonly construction: boolean;
}

export type Geometry = PointGeometry | LineGeometry | CircleGeometry | ArcGeometry;
