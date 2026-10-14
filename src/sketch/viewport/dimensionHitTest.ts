import type { Point2D } from "../geometry/Point2D.ts";
import type { ConstraintId } from "../model/Constraint.ts";
import type { Sketch } from "../model/Sketch.ts";
import type { Camera } from "./Camera.ts";
import { worldToScreen } from "./Camera.ts";
import {
  layoutConstraintAnnotations,
  type AnnotationLayoutOptions,
} from "./annotationLayout.ts";

const HIT_PADDING_PX = 8;

export interface DimensionLabelHit {
  readonly constraintId: ConstraintId;
  readonly screen: Point2D;
  readonly text: string;
}

/**
 * Hit-test dimension labels in screen space (same layout as drawConstraintAnnotations).
 */
export function hitTestDimensionLabel(
  sketch: Sketch,
  worldPoint: Point2D,
  camera: Camera,
  measureTextWidth: (text: string) => number,
  layoutOptions?: AnnotationLayoutOptions,
): DimensionLabelHit | null {
  const screenCursor = worldToScreen(worldPoint, camera);
  const placed = layoutConstraintAnnotations(
    sketch,
    camera,
    measureTextWidth,
    layoutOptions,
  );
  let best: DimensionLabelHit | null = null;
  let bestDist = Number.POSITIVE_INFINITY;

  for (const label of placed) {
    if (!label.dimension) {
      continue;
    }
    const left = label.screenX - label.width / 2 - HIT_PADDING_PX;
    const right = label.screenX + label.width / 2 + HIT_PADDING_PX;
    const top = label.screenY - label.height / 2 - HIT_PADDING_PX;
    const bottom = label.screenY + label.height / 2 + HIT_PADDING_PX;
    if (
      screenCursor.x < left ||
      screenCursor.x > right ||
      screenCursor.y < top ||
      screenCursor.y > bottom
    ) {
      continue;
    }
    const dist = Math.hypot(
      screenCursor.x - label.screenX,
      screenCursor.y - label.screenY,
    );
    if (dist < bestDist) {
      bestDist = dist;
      best = {
        constraintId: label.constraintId,
        screen: { x: label.screenX, y: label.screenY },
        text: label.text,
      };
    }
  }

  return best;
}
