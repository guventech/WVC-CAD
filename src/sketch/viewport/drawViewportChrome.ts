import type { Camera } from "./Camera.ts";
import { screenToWorld, worldToScreen } from "./Camera.ts";
import { chooseGridSpacing } from "./Grid.ts";
import type { SketchFrame } from "../model/SketchFrame.ts";
import { resolveFrameOrigin } from "../model/SketchFrame.ts";
import type { SelectionState } from "../selection/SelectionManager.ts";
import type { ViewportSize } from "./ViewportSize.ts";
import { VIEWPORT_COLORS } from "./viewportColors.ts";

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  viewport: ViewportSize,
): void {
  const spacing = chooseGridSpacing(camera.scale);
  const topLeft = screenToWorld({ x: 0, y: 0 }, camera);
  const bottomRight = screenToWorld(
    { x: viewport.width, y: viewport.height },
    camera,
  );

  const minX = Math.min(topLeft.x, bottomRight.x);
  const maxX = Math.max(topLeft.x, bottomRight.x);
  const minY = Math.min(topLeft.y, bottomRight.y);
  const maxY = Math.max(topLeft.y, bottomRight.y);

  const startX = Math.floor(minX / spacing.minorMm) * spacing.minorMm;
  const startY = Math.floor(minY / spacing.minorMm) * spacing.minorMm;

  // Batch strokes: one path per style. Per-line stroke() is expensive on weak GPUs.
  ctx.lineWidth = 1;
  ctx.strokeStyle = VIEWPORT_COLORS.minorGrid;
  ctx.beginPath();
  for (let x = startX; x <= maxX + spacing.minorMm; x += spacing.minorMm) {
    if (isMajorLine(x, spacing.majorMm)) {
      continue;
    }
    const screenX = worldToScreen({ x, y: 0 }, camera).x;
    ctx.moveTo(screenX, 0);
    ctx.lineTo(screenX, viewport.height);
  }
  for (let y = startY; y <= maxY + spacing.minorMm; y += spacing.minorMm) {
    if (isMajorLine(y, spacing.majorMm)) {
      continue;
    }
    const screenY = worldToScreen({ x: 0, y }, camera).y;
    ctx.moveTo(0, screenY);
    ctx.lineTo(viewport.width, screenY);
  }
  ctx.stroke();

  ctx.strokeStyle = VIEWPORT_COLORS.majorGrid;
  ctx.beginPath();
  for (let x = startX; x <= maxX + spacing.minorMm; x += spacing.minorMm) {
    if (!isMajorLine(x, spacing.majorMm)) {
      continue;
    }
    const screenX = worldToScreen({ x, y: 0 }, camera).x;
    ctx.moveTo(screenX, 0);
    ctx.lineTo(screenX, viewport.height);
  }
  for (let y = startY; y <= maxY + spacing.minorMm; y += spacing.minorMm) {
    if (!isMajorLine(y, spacing.majorMm)) {
      continue;
    }
    const screenY = worldToScreen({ x: 0, y }, camera).y;
    ctx.moveTo(0, screenY);
    ctx.lineTo(viewport.width, screenY);
  }
  ctx.stroke();
}

/**
 * Draw the sketch datum frame (infinite X/Y axes + origin + labels).
 * Highlight follows selection/hover of datum ids.
 */
export function drawSketchFrame(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  viewport: ViewportSize,
  frame: SketchFrame,
  selection?: SelectionState,
): void {
  const originWorld = resolveFrameOrigin(frame);
  const origin = worldToScreen(originWorld, camera);

  for (const axis of frame.axes) {
    const selected = selection?.selectedIds.includes(axis.id) ?? false;
    const hovered =
      !selected && selection?.hoveredId === axis.id;
    const baseColor =
      axis.tag === "x"
        ? VIEWPORT_COLORS.xAxis
        : axis.tag === "y"
          ? VIEWPORT_COLORS.yAxis
          : VIEWPORT_COLORS.origin;
    const stroke = selected
      ? VIEWPORT_COLORS.selected
      : hovered
        ? VIEWPORT_COLORS.preview
        : baseColor;
    const width = selected || hovered ? 2.5 : 1.5;

    ctx.lineWidth = width;
    ctx.strokeStyle = stroke;
    ctx.beginPath();
    if (axis.tag === "x" || (axis.direction.x !== 0 && axis.direction.y === 0)) {
      ctx.moveTo(0, origin.y);
      ctx.lineTo(viewport.width, origin.y);
    } else if (
      axis.tag === "y" ||
      (axis.direction.y !== 0 && axis.direction.x === 0)
    ) {
      ctx.moveTo(origin.x, 0);
      ctx.lineTo(origin.x, viewport.height);
    }
    ctx.stroke();

    drawAxisLabel(ctx, camera, viewport, axis.tag.toUpperCase(), axis.tag, origin);
  }

  const originSelected = selection?.selectedIds.includes(frame.originId) ?? false;
  const originHovered =
    !originSelected && selection?.hoveredId === frame.originId;
  drawOriginMarker(ctx, camera, originWorld, {
    selected: originSelected,
    hovered: originHovered,
  });
}

export function drawOriginMarker(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  originWorld: { readonly x: number; readonly y: number } = { x: 0, y: 0 },
  options?: { readonly selected?: boolean; readonly hovered?: boolean },
): void {
  const origin = worldToScreen(originWorld, camera);
  const size = options?.selected || options?.hovered ? 7 : 5;
  const color = options?.selected
    ? VIEWPORT_COLORS.selected
    : options?.hovered
      ? VIEWPORT_COLORS.preview
      : VIEWPORT_COLORS.origin;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(origin.x, origin.y, options?.selected || options?.hovered ? 3.5 : 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.lineWidth = options?.selected || options?.hovered ? 1.5 : 1;
  ctx.beginPath();
  ctx.moveTo(origin.x - size, origin.y);
  ctx.lineTo(origin.x + size, origin.y);
  ctx.moveTo(origin.x, origin.y - size);
  ctx.lineTo(origin.x, origin.y + size);
  ctx.stroke();
}

function drawAxisLabel(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  viewport: ViewportSize,
  label: string,
  tag: string,
  originScreen: { readonly x: number; readonly y: number },
): void {
  ctx.save();
  ctx.fillStyle = tag === "x" ? VIEWPORT_COLORS.xAxis : VIEWPORT_COLORS.yAxis;
  ctx.font = "11px sans-serif";
  ctx.textBaseline = "middle";
  if (tag === "x") {
    ctx.textAlign = "right";
    ctx.fillText(label, viewport.width - 8, originScreen.y - 10);
  } else {
    ctx.textAlign = "left";
    ctx.fillText(label, originScreen.x + 8, 14);
  }
  void camera;
  ctx.restore();
}

function isMajorLine(worldCoordinate: number, majorMm: number): boolean {
  const quotient = worldCoordinate / majorMm;
  return Math.abs(quotient - Math.round(quotient)) < 1e-9;
}
