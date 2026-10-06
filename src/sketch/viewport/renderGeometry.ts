import { arcSweepRadians } from "../geometry/GeometryMath.ts";
import { listHandlePoints, pointOnCircle } from "../geometry/EntityFeatures.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import type { Geometry } from "../model/Geometry.ts";
import type { SelectionState } from "../selection/SelectionManager.ts";
import type { Camera } from "../viewport/Camera.ts";
import { worldToScreen } from "../viewport/Camera.ts";
import { VIEWPORT_COLORS } from "./viewportColors.ts";

const COLORS = {
  normal: VIEWPORT_COLORS.geometry,
  construction: VIEWPORT_COLORS.construction,
  hover: VIEWPORT_COLORS.preview,
  selected: VIEWPORT_COLORS.selected,
  handle: VIEWPORT_COLORS.handle,
} as const;

export interface GeometryRenderOptions {
  readonly camera: Camera;
  readonly geometry: readonly Geometry[];
  readonly selection: SelectionState;
}

export function renderGeometry(
  ctx: CanvasRenderingContext2D,
  options: GeometryRenderOptions,
): void {
  const { camera, geometry, selection } = options;

  for (const entity of geometry) {
    if (selection.selectedIds.includes(entity.id)) {
      continue;
    }
    if (selection.hoveredId === entity.id) {
      continue;
    }
    drawEntity(ctx, entity, camera, entity.construction ? COLORS.construction : COLORS.normal, 1.25);
  }

  if (selection.hoveredId !== null && !selection.selectedIds.includes(selection.hoveredId)) {
    const hovered = geometry.find((entity) => entity.id === selection.hoveredId);
    if (hovered !== undefined) {
      drawEntity(ctx, hovered, camera, COLORS.hover, 2);
    }
  }

  for (const id of selection.selectedIds) {
    const selected = geometry.find((entity) => entity.id === id);
    if (selected !== undefined) {
      drawEntity(ctx, selected, camera, COLORS.selected, 2.25);
      drawHandles(ctx, selected, camera);
    }
  }
}

function drawEntity(
  ctx: CanvasRenderingContext2D,
  entity: Geometry,
  camera: Camera,
  stroke: string,
  lineWidth: number,
): void {
  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.fillStyle = stroke;
  ctx.lineWidth = lineWidth;
  if (entity.construction) {
    ctx.setLineDash([4, 4]);
  }

  switch (entity.type) {
    case "point":
      drawPointMarker(ctx, worldToScreen(entity.position, camera), 3.5);
      break;
    case "line": {
      const start = worldToScreen(entity.start, camera);
      const end = worldToScreen(entity.end, camera);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      break;
    }
    case "circle": {
      const center = worldToScreen(entity.center, camera);
      ctx.beginPath();
      ctx.arc(center.x, center.y, entity.radius * camera.scale, 0, Math.PI * 2);
      ctx.stroke();
      drawPointMarker(ctx, center, 2);
      break;
    }
    case "arc":
      drawArc(ctx, entity, camera);
      drawPointMarker(ctx, worldToScreen(entity.center, camera), 2);
      break;
  }

  ctx.restore();
}

function drawHandles(
  ctx: CanvasRenderingContext2D,
  entity: Geometry,
  camera: Camera,
): void {
  ctx.save();
  ctx.fillStyle = COLORS.handle;
  ctx.strokeStyle = COLORS.selected;
  ctx.lineWidth = 1;

  for (const handle of listHandlePoints(entity)) {
    const screen = worldToScreen(handle, camera);
    ctx.beginPath();
    ctx.rect(screen.x - 3, screen.y - 3, 6, 6);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawArc(
  ctx: CanvasRenderingContext2D,
  entity: Extract<Geometry, { type: "arc" }>,
  camera: Camera,
): void {
  const sweep = arcSweepRadians(entity.startAngle, entity.endAngle);
  const radiusPx = entity.radius * camera.scale;
  const steps = Math.max(16, Math.ceil((radiusPx * sweep) / 8));

  ctx.beginPath();
  for (let i = 0; i <= steps; i += 1) {
    const angle = entity.startAngle + (sweep * i) / steps;
    const world = pointOnCircle(entity.center, entity.radius, angle);
    const screen = worldToScreen(world, camera);
    if (i === 0) {
      ctx.moveTo(screen.x, screen.y);
    } else {
      ctx.lineTo(screen.x, screen.y);
    }
  }
  ctx.stroke();
}

function drawPointMarker(
  ctx: CanvasRenderingContext2D,
  screen: Point2D,
  radius: number,
): void {
  ctx.beginPath();
  ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
  ctx.fill();
}
