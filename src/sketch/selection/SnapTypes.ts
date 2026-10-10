import type { Point2D } from "../geometry/Point2D.ts";
import type { EntityId } from "../model/Geometry.ts";

export type SnapType =
  | "grid"
  | "origin"
  | "axis"
  | "endpoint"
  | "point"
  | "midpoint"
  | "center"
  | "intersection"
  | "onEntity"
  | "horizontal"
  | "vertical";

export interface SnapCandidate {
  readonly type: SnapType;
  readonly point: Point2D;
  readonly sourceEntityId?: EntityId;
  readonly priority: number;
  readonly label: string;
}
