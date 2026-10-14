import type { Sketch } from "../model/Sketch.ts";
import type { Camera } from "./Camera.ts";
import {
  layoutConstraintAnnotations,
  type AnnotationLayoutOptions,
} from "./annotationLayout.ts";
import { drawDimensionLeaders } from "./drawDimensionLeaders.ts";
import { VIEWPORT_COLORS } from "./viewportColors.ts";

/**
 * Draw H/V glyphs and dimension labels. View-only: values are measured from
 * the (possibly drag-previewed) sketch, never read back into the model.
 * Label positions are deconflicted in screen space so blue dimensions never stack.
 */
export function drawConstraintAnnotations(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  sketch: Sketch,
  layoutOptions?: AnnotationLayoutOptions,
): void {
  drawDimensionLeaders(ctx, camera, sketch);

  ctx.save();
  ctx.font = "11px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const placed = layoutConstraintAnnotations(
    sketch,
    camera,
    (text) => ctx.measureText(text).width,
    layoutOptions,
  );

  for (const label of placed) {
    ctx.fillStyle = VIEWPORT_COLORS.background;
    ctx.fillRect(
      label.screenX - label.width / 2,
      label.screenY - label.height / 2,
      label.width,
      label.height,
    );
    ctx.fillStyle = label.dimension
      ? VIEWPORT_COLORS.dimension
      : VIEWPORT_COLORS.constraintGlyph;
    ctx.fillText(label.text, label.screenX, label.screenY);
  }

  ctx.restore();
}
