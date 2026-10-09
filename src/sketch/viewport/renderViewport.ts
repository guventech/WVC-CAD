import type { Camera } from "./Camera.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import type { EntityId, Geometry } from "../model/Geometry.ts";
import type { Sketch } from "../model/Sketch.ts";
import type { FreeHandle } from "../constraints/UnderConstrainedViz.ts";
import { drawConstraintAnnotations } from "./drawConstraintAnnotations.ts";
import { drawDofMarkers } from "./drawDofMarkers.ts";
import type { SelectionState } from "../selection/SelectionManager.ts";
import type { SnapCandidate } from "../selection/SnapEngine.ts";
import type {
  ArcPreview,
  CirclePreview,
  LinePreview,
  RectanglePreview,
} from "../tools/ToolTypes.ts";
import {
  drawPreviewArc,
  drawPreviewCircle,
  drawPreviewLine,
  drawPreviewPoint,
  drawPreviewRectangle,
  drawSnapMarker,
} from "./drawToolPreviews.ts";
import { createDefaultSketchFrame, type SketchFrame } from "../model/SketchFrame.ts";
import {
  drawGrid,
  drawSketchFrame,
} from "./drawViewportChrome.ts";
import { renderGeometry } from "./renderGeometry.ts";
import type { ViewportSize } from "./ViewportSize.ts";
import { VIEWPORT_COLORS } from "./viewportColors.ts";

export interface ViewportRenderOptions {
  readonly camera: Camera;
  readonly viewport: ViewportSize;
  readonly gridVisible: boolean;
  readonly geometry?: readonly Geometry[];
  /** Sketch whose constraints are annotated (H/V glyphs, dimension labels). */
  readonly annotationSketch?: Sketch | null;
  /** World datum frame; defaults to annotationSketch.frame or the default frame. */
  readonly frame?: SketchFrame;
  /** Free handles for under-constrained visualization (Chunk 17). */
  readonly freeHandles?: readonly FreeHandle[];
  /** Fully constrained entities drawn green (U6). */
  readonly fullyConstrainedIds?: ReadonlySet<EntityId>;
  readonly selection?: SelectionState;
  readonly previewPoint?: Point2D | null;
  readonly previewLine?: LinePreview | null;
  readonly previewRectangle?: RectanglePreview | null;
  readonly previewCircle?: CirclePreview | null;
  readonly previewArc?: ArcPreview | null;
  readonly activeSnap?: SnapCandidate | null;
  readonly backgroundColor?: string;
}

export function renderViewport(
  ctx: CanvasRenderingContext2D,
  options: ViewportRenderOptions,
): void {
  const {
    camera,
    viewport,
    gridVisible,
    geometry = [],
    annotationSketch = null,
    frame,
    freeHandles = [],
    fullyConstrainedIds,
    selection,
    previewPoint = null,
    previewLine = null,
    previewRectangle = null,
    previewCircle = null,
    previewArc = null,
    activeSnap = null,
    backgroundColor = VIEWPORT_COLORS.background,
  } = options;

  const sketchFrame =
    frame ?? annotationSketch?.frame ?? createDefaultSketchFrame();

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, viewport.width, viewport.height);
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, viewport.width, viewport.height);

  if (gridVisible) {
    drawGrid(ctx, camera, viewport);
  }

  drawSketchFrame(ctx, camera, viewport, sketchFrame, selection);

  if (geometry.length > 0 && selection !== undefined) {
    renderGeometry(ctx, {
      camera,
      geometry,
      selection,
      fullyConstrainedIds,
    });
  }

  if (freeHandles.length > 0) {
    drawDofMarkers(ctx, camera, freeHandles);
  }

  if (annotationSketch !== null && annotationSketch.constraints.length > 0) {
    drawConstraintAnnotations(ctx, camera, annotationSketch);
  }

  if (previewLine !== null) {
    drawPreviewLine(ctx, camera, previewLine, activeSnap);
  }

  if (previewRectangle !== null) {
    drawPreviewRectangle(ctx, camera, previewRectangle);
  }

  if (previewCircle !== null) {
    drawPreviewCircle(ctx, camera, previewCircle);
  }

  if (previewArc !== null) {
    drawPreviewArc(ctx, camera, previewArc);
  }

  if (previewPoint !== null) {
    drawPreviewPoint(ctx, camera, previewPoint);
  }

  if (activeSnap !== null) {
    drawSnapMarker(ctx, camera, activeSnap);
  }

  ctx.restore();
}
