import { resolveConstraintPoint } from "../constraints/ConstraintRef.ts";
import {
  distanceHandles,
  referencedLine,
  resolveCoordinatePoint,
} from "../constraints/Dimensions.ts";
import { pointOnCircle } from "../geometry/EntityFeatures.ts";
import type { Point2D } from "../geometry/Point2D.ts";
import type { Constraint } from "../model/Constraint.ts";
import { isDrivingConstraint } from "../model/Constraint.ts";
import type { Sketch } from "../model/Sketch.ts";
import type { Camera } from "./Camera.ts";
import { worldToScreen } from "./Camera.ts";
import { radialDimensionAngle } from "./radialDimensionAngle.ts";
import { VIEWPORT_COLORS } from "./viewportColors.ts";

/**
 * Draw simple CAD-like extension/arrow leaders for driving linear and radial dims.
 * View-only; does not affect the model.
 */
export function drawDimensionLeaders(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  sketch: Sketch,
): void {
  ctx.save();
  ctx.strokeStyle = VIEWPORT_COLORS.dimension;
  ctx.fillStyle = VIEWPORT_COLORS.dimension;
  ctx.lineWidth = 1;

  for (const constraint of sketch.constraints) {
    if (!isDrivingConstraint(constraint)) {
      continue;
    }
    if (constraint.type === "length" || constraint.type === "distance") {
      const points = linearLeaderEndpoints(sketch, constraint);
      if (points !== null) {
        drawLinearLeader(ctx, camera, points.a, points.b);
      }
    } else if (constraint.type === "horizontal-distance") {
      const points = linearLeaderEndpoints(sketch, constraint);
      if (points !== null) {
        drawOrthogonalLeader(ctx, camera, points.a, points.b, "horizontal");
      }
    } else if (constraint.type === "vertical-distance") {
      const points = linearLeaderEndpoints(sketch, constraint);
      if (points !== null) {
        drawOrthogonalLeader(ctx, camera, points.a, points.b, "vertical");
      }
    } else if (constraint.type === "coordinate-x") {
      const point = resolveCoordinatePoint(sketch, constraint.references[0]);
      if (point !== null) {
        drawOrthogonalLeader(
          ctx,
          camera,
          { x: 0, y: point.y },
          { x: point.x, y: point.y },
          "horizontal",
        );
      }
    } else if (constraint.type === "coordinate-y") {
      const point = resolveCoordinatePoint(sketch, constraint.references[0]);
      if (point !== null) {
        drawOrthogonalLeader(
          ctx,
          camera,
          { x: point.x, y: 0 },
          { x: point.x, y: point.y },
          "vertical",
        );
      }
    } else if (constraint.type === "radius" || constraint.type === "diameter") {
      drawRadialLeader(ctx, camera, sketch, constraint);
    }
  }

  ctx.restore();
}

function linearLeaderEndpoints(
  sketch: Sketch,
  constraint: Constraint,
): { readonly a: Point2D; readonly b: Point2D } | null {
  if (constraint.type === "length") {
    const line = referencedLine(sketch, constraint.references[0]);
    return line === null ? null : { a: line.start, b: line.end };
  }
  const handles = distanceHandles(sketch, constraint.references);
  if (handles === null) {
    return null;
  }
  const a = resolveConstraintPoint(sketch, handles[0]);
  const b = resolveConstraintPoint(sketch, handles[1]);
  if (a === null || b === null) {
    return null;
  }
  return { a, b };
}

/**
 * True distance (diagonal-capable) leader parallel to A→B with short extensions.
 */
function drawLinearLeader(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  a: Point2D,
  b: Point2D,
): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (!(len > 1e-9)) {
    return;
  }
  const offsetWorld = 4 / camera.scale;
  const nx = (-dy / len) * offsetWorld;
  const ny = (dx / len) * offsetWorld;
  const a2 = { x: a.x + nx, y: a.y + ny };
  const b2 = { x: b.x + nx, y: b.y + ny };
  strokeLeader(ctx, camera, a, b, a2, b2);
}

/**
 * Horizontal / vertical distance leaders stay axis-aligned even when the
 * referenced points sit at different X and Y (e.g. filleted rectangle corners).
 */
export function orthogonalLeaderGeometry(
  a: Point2D,
  b: Point2D,
  axis: "horizontal" | "vertical",
  offsetWorld: number,
): {
  readonly dimA: Point2D;
  readonly dimB: Point2D;
  readonly extA: Point2D;
  readonly extB: Point2D;
} {
  if (axis === "horizontal") {
    const yBase = Math.max(a.y, b.y);
    const yDim = yBase + Math.abs(offsetWorld);
    return {
      extA: a,
      extB: b,
      dimA: { x: a.x, y: yDim },
      dimB: { x: b.x, y: yDim },
    };
  }
  const xBase = Math.max(a.x, b.x);
  const xDim = xBase + Math.abs(offsetWorld);
  return {
    extA: a,
    extB: b,
    dimA: { x: xDim, y: a.y },
    dimB: { x: xDim, y: b.y },
  };
}

function drawOrthogonalLeader(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  a: Point2D,
  b: Point2D,
  axis: "horizontal" | "vertical",
): void {
  const offsetWorld = 10 / camera.scale;
  const { dimA, dimB, extA, extB } = orthogonalLeaderGeometry(
    a,
    b,
    axis,
    offsetWorld,
  );
  if (axis === "horizontal" && Math.abs(dimB.x - dimA.x) < 1e-9) {
    return;
  }
  if (axis === "vertical" && Math.abs(dimB.y - dimA.y) < 1e-9) {
    return;
  }
  strokeLeader(ctx, camera, extA, extB, dimA, dimB);
}

function strokeLeader(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  extA: Point2D,
  extB: Point2D,
  dimA: Point2D,
  dimB: Point2D,
): void {
  const s0 = worldToScreen(extA, camera);
  const s1 = worldToScreen(extB, camera);
  const sa = worldToScreen(dimA, camera);
  const sb = worldToScreen(dimB, camera);

  ctx.beginPath();
  ctx.moveTo(s0.x, s0.y);
  ctx.lineTo(sa.x, sa.y);
  ctx.moveTo(s1.x, s1.y);
  ctx.lineTo(sb.x, sb.y);
  ctx.moveTo(sa.x, sa.y);
  ctx.lineTo(sb.x, sb.y);
  ctx.stroke();

  drawArrowHead(ctx, sa, sb);
  drawArrowHead(ctx, sb, sa);
}

function drawRadialLeader(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  sketch: Sketch,
  constraint: Constraint,
): void {
  const entity = sketch.geometry.find(
    (item) => item.id === constraint.references[0]?.entityId,
  );
  if (entity?.type !== "circle" && entity?.type !== "arc") {
    return;
  }
  const angle = radialDimensionAngle(entity, constraint.id);
  const rim = pointOnCircle(entity.center, entity.radius, angle);
  const rimScreen = worldToScreen(rim, camera);
  ctx.beginPath();
  if (constraint.type === "diameter") {
    const opposite = pointOnCircle(entity.center, entity.radius, angle + Math.PI);
    const oppScreen = worldToScreen(opposite, camera);
    ctx.moveTo(oppScreen.x, oppScreen.y);
    ctx.lineTo(rimScreen.x, rimScreen.y);
    ctx.stroke();
    drawArrowHead(ctx, oppScreen, rimScreen);
    drawArrowHead(ctx, rimScreen, oppScreen);
    return;
  }

  if (entity.type === "arc") {
    // Fillet/arc radius: short leader outside the arc, arrow tip on the curve
    // pointing at that corner (not a shared fixed up-right direction).
    const outside = pointOnCircle(
      entity.center,
      entity.radius + 14 / camera.scale,
      angle,
    );
    const outScreen = worldToScreen(outside, camera);
    ctx.moveTo(outScreen.x, outScreen.y);
    ctx.lineTo(rimScreen.x, rimScreen.y);
    ctx.stroke();
    drawArrowHead(ctx, outScreen, rimScreen);
    return;
  }

  const center = worldToScreen(entity.center, camera);
  ctx.moveTo(center.x, center.y);
  ctx.lineTo(rimScreen.x, rimScreen.y);
  ctx.stroke();
  drawArrowHead(ctx, center, rimScreen);
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  from: Point2D,
  to: Point2D,
): void {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (!(len > 1e-6)) {
    return;
  }
  const ux = dx / len;
  const uy = dy / len;
  const size = 7;
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - ux * size - uy * size * 0.45, to.y - uy * size + ux * size * 0.45);
  ctx.lineTo(to.x - ux * size + uy * size * 0.45, to.y - uy * size - ux * size * 0.45);
  ctx.closePath();
  ctx.fill();
}
