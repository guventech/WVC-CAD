import type { Point2D } from "../geometry/Point2D.ts";
import type { RectangleEdgeKey } from "../geometry/RectangleMath.ts";
import type { EntityId } from "../model/Geometry.ts";

/** What is being dragged by the Select tool. */
export type GeometryDragTarget =
  | { readonly kind: "point"; readonly entityId: EntityId }
  | { readonly kind: "circle-center"; readonly entityId: EntityId }
  | { readonly kind: "circle-radius"; readonly entityId: EntityId }
  | { readonly kind: "arc-center"; readonly entityId: EntityId }
  | { readonly kind: "arc-radius"; readonly entityId: EntityId }
  | {
      readonly kind: "line-endpoint";
      readonly entityId: EntityId;
      readonly which: "start" | "end";
    }
  | {
      readonly kind: "line-body";
      readonly entityId: EntityId;
      /** Grab point relative to line start at drag begin. */
      readonly grabOffset: Point2D;
      /** end − start at drag begin (length and angle preserved). */
      readonly span: Point2D;
    }
  | {
      readonly kind: "rectangle-edge";
      readonly entityId: EntityId;
      readonly edge: RectangleEdgeKey;
    };
