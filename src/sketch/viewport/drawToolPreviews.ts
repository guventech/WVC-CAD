import type { Camera } from "./Camera.ts";
import { worldToScreen } from "./Camera.ts";
import { arcSweepRadians, distance } from "../geometry/GeometryMath.ts";
import { pointOnCircle } from "../geometry/EntityFeatures.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import { axisAlignedCornersFromDiagonal } from "../geometry/RectangleMath.ts";
import type { SnapCandidate } from "../selection/SnapEngine.ts";
import type {
  ArcPreview,
  CirclePreview,
  LinePreview,
  RectanglePreview,
} from "../tools/ToolTypes.ts";
import { VIEWPORT_COLORS } from "./viewportColors.ts";

export function drawPreviewArc(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  preview: ArcPreview,
): void {
  if (!(preview.radius > 0)) {
    return;
  }

  const center = worldToScreen(preview.center, camera);
  const start = worldToScreen(
    pointOnCircle(preview.center, preview.radius, preview.startAngle),
    camera,
  );

  ctx.save();
  ctx.strokeStyle = VIEWPORT_COLORS.preview;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);

  if (preview.showFullCircleGuide) {
    ctx.beginPath();
    ctx.arc(center.x, center.y, preview.radius * camera.scale, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    const sweep = arcSweepRadians(preview.startAngle, preview.endAngle);
    const radiusPx = preview.radius * camera.scale;
    const steps = Math.max(16, Math.ceil((radiusPx * sweep) / 8));
    ctx.beginPath();
    for (let i = 0; i <= steps; i += 1) {
      const angle = preview.startAngle + (sweep * i) / steps;
      const screen = worldToScreen(
        pointOnCircle(preview.center, preview.radius, angle),
        camera,
      );
      if (i === 0) {
        ctx.moveTo(screen.x, screen.y);
      } else {
        ctx.lineTo(screen.x, screen.y);
      }
    }
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(center.x, center.y);
  ctx.lineTo(start.x, start.y);
  ctx.stroke();
  ctx.restore();
}

export function drawPreviewCircle(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  preview: CirclePreview,
): void {
  const radius = distance(preview.center, preview.radiusPoint);
  if (!(radius > 0)) {
    return;
  }

  const center = worldToScreen(preview.center, camera);
  const rim = worldToScreen(preview.radiusPoint, camera);

  ctx.save();
  ctx.strokeStyle = VIEWPORT_COLORS.preview;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius * camera.scale, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(center.x, center.y);
  ctx.lineTo(rim.x, rim.y);
  ctx.stroke();
  ctx.restore();
}

export function drawPreviewRectangle(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  preview: RectanglePreview,
): void {
  const corners = axisAlignedCornersFromDiagonal(preview.cornerA, preview.cornerB);
  if (corners === null) {
    return;
  }

  const bl = worldToScreen(corners.bl, camera);
  const br = worldToScreen(corners.br, camera);
  const tr = worldToScreen(corners.tr, camera);
  const tl = worldToScreen(corners.tl, camera);

  ctx.save();
  ctx.strokeStyle = VIEWPORT_COLORS.preview;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(bl.x, bl.y);
  ctx.lineTo(br.x, br.y);
  ctx.lineTo(tr.x, tr.y);
  ctx.lineTo(tl.x, tl.y);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

export function drawPreviewLine(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  line: LinePreview,
  activeSnap: SnapCandidate | null,
): void {
  const start = worldToScreen(line.start, camera);
  const end = worldToScreen(line.end, camera);
  const isOrientation =
    activeSnap?.type === "horizontal" || activeSnap?.type === "vertical";

  ctx.save();
  ctx.strokeStyle = isOrientation
    ? VIEWPORT_COLORS.inference
    : VIEWPORT_COLORS.preview;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.setLineDash([]);

  if (activeSnap?.type === "horizontal" || activeSnap?.type === "vertical") {
    drawInferenceTick(ctx, end, activeSnap.type);
  }

  ctx.restore();
}

export function drawPreviewPoint(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  point: Point2D,
): void {
  const screen = worldToScreen(point, camera);
  ctx.save();
  ctx.strokeStyle = VIEWPORT_COLORS.preview;
  ctx.fillStyle = VIEWPORT_COLORS.preview;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(screen.x, screen.y, 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(screen.x, screen.y, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawSnapMarker(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  snap: SnapCandidate,
): void {
  const screen = worldToScreen(snap.point, camera);
  const size = snap.type === "origin" || snap.type === "axis" ? 7 : 5;
  ctx.save();
  ctx.strokeStyle =
    snap.type === "horizontal" || snap.type === "vertical"
      ? VIEWPORT_COLORS.inference
      : VIEWPORT_COLORS.snap;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(screen.x - size, screen.y);
  ctx.lineTo(screen.x + size, screen.y);
  ctx.moveTo(screen.x, screen.y - size);
  ctx.lineTo(screen.x, screen.y + size);

  if (
    snap.type === "endpoint" ||
    snap.type === "point" ||
    snap.type === "origin" ||
    snap.type === "axis" ||
    snap.type === "horizontal" ||
    snap.type === "vertical"
  ) {
    ctx.strokeRect(screen.x - size * 0.7, screen.y - size * 0.7, size * 1.4, size * 1.4);
  } else if (snap.type === "midpoint") {
    ctx.moveTo(screen.x, screen.y - size);
    ctx.lineTo(screen.x + size, screen.y);
    ctx.lineTo(screen.x, screen.y + size);
    ctx.lineTo(screen.x - size, screen.y);
    ctx.closePath();
  } else if (snap.type === "center") {
    ctx.moveTo(screen.x + size, screen.y);
    ctx.arc(screen.x, screen.y, size, 0, Math.PI * 2);
  } else if (snap.type === "onEntity" || snap.type === "intersection") {
    ctx.moveTo(screen.x - size * 0.6, screen.y - size * 0.6);
    ctx.lineTo(screen.x + size * 0.6, screen.y + size * 0.6);
    ctx.moveTo(screen.x + size * 0.6, screen.y - size * 0.6);
    ctx.lineTo(screen.x - size * 0.6, screen.y + size * 0.6);
  }

  ctx.stroke();
  ctx.restore();
}

function drawInferenceTick(
  ctx: CanvasRenderingContext2D,
  screen: Point2D,
  type: "horizontal" | "vertical",
): void {
  const size = 8;
  ctx.strokeStyle = VIEWPORT_COLORS.inference;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (type === "horizontal") {
    ctx.moveTo(screen.x - size, screen.y);
    ctx.lineTo(screen.x + size, screen.y);
  } else {
    ctx.moveTo(screen.x, screen.y - size);
    ctx.lineTo(screen.x, screen.y + size);
  }
  ctx.stroke();
}
