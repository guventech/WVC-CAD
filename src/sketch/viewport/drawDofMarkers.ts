import type { FreeHandle } from "../constraints/UnderConstrainedViz.ts";
import type { Camera } from "./Camera.ts";
import { worldToScreen } from "./Camera.ts";
import { VIEWPORT_COLORS } from "./viewportColors.ts";

/**
 * Draw amber DOF markers on free handles (under-constrained visualization).
 * Axis ticks show when only X or only Y remains free.
 */
export function drawDofMarkers(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  freeHandles: readonly FreeHandle[],
): void {
  if (freeHandles.length === 0) {
    return;
  }

  ctx.save();
  for (const handle of freeHandles) {
    const screen = worldToScreen(handle.point, camera);
    const color = VIEWPORT_COLORS.dof;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.5;

    // Diamond marker
    const s = handle.role === "radius" ? 5 : 4.5;
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y - s);
    ctx.lineTo(screen.x + s, screen.y);
    ctx.lineTo(screen.x, screen.y + s);
    ctx.lineTo(screen.x - s, screen.y);
    ctx.closePath();
    ctx.globalAlpha = 0.35;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();

    // Direction ticks for single-axis freedom
    if (handle.freeX && !handle.freeY && !handle.freeRadius) {
      ctx.beginPath();
      ctx.moveTo(screen.x - 8, screen.y);
      ctx.lineTo(screen.x + 8, screen.y);
      ctx.stroke();
    } else if (handle.freeY && !handle.freeX && !handle.freeRadius) {
      ctx.beginPath();
      ctx.moveTo(screen.x, screen.y - 8);
      ctx.lineTo(screen.x, screen.y + 8);
      ctx.stroke();
    }
  }
  ctx.restore();
}
