import { TOLERANCE } from "./GeometryMath.ts";
import type { Point2D } from "./Point2D.ts";

/** Axis-aligned rectangle corners, CCW from bottom-left. */
export interface RectangleCorners {
  readonly bl: Point2D;
  readonly br: Point2D;
  readonly tr: Point2D;
  readonly tl: Point2D;
}

export type RectangleCornerKey = keyof RectangleCorners;

export type RectangleEdgeKey = "bottom" | "right" | "top" | "left";

export interface RectMetrics {
  readonly widthMm: number;
  readonly heightMm: number;
}

/** Build an axis-aligned rectangle from two opposite corner picks. */
export function axisAlignedCornersFromDiagonal(
  a: Point2D,
  b: Point2D,
): RectangleCorners | null {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);

  if (
    maxX - minX <= TOLERANCE.coincidence ||
    maxY - minY <= TOLERANCE.coincidence
  ) {
    return null;
  }

  return {
    bl: { x: minX, y: minY },
    br: { x: maxX, y: minY },
    tr: { x: maxX, y: maxY },
    tl: { x: minX, y: maxY },
  };
}

export function rectangleMetrics(corners: RectangleCorners): RectMetrics {
  return {
    widthMm: corners.br.x - corners.bl.x,
    heightMm: corners.tl.y - corners.bl.y,
  };
}

/**
 * Move one corner of an axis-aligned rectangle; adjacent corners follow so
 * edges stay horizontal/vertical and the opposite corner stays fixed in the
 * free diagonal sense (standard CAD corner drag).
 */
export function moveRectangleCorner(
  corners: RectangleCorners,
  corner: RectangleCornerKey,
  position: Point2D,
): RectangleCorners | null {
  let next: RectangleCorners;

  switch (corner) {
    case "bl":
      next = {
        bl: { x: position.x, y: position.y },
        br: { x: corners.br.x, y: position.y },
        tr: { x: corners.br.x, y: corners.tr.y },
        tl: { x: position.x, y: corners.tl.y },
      };
      break;
    case "br":
      next = {
        bl: { x: corners.bl.x, y: position.y },
        br: { x: position.x, y: position.y },
        tr: { x: position.x, y: corners.tr.y },
        tl: { x: corners.tl.x, y: corners.tr.y },
      };
      break;
    case "tr":
      next = {
        bl: { x: corners.bl.x, y: corners.bl.y },
        br: { x: position.x, y: corners.br.y },
        tr: { x: position.x, y: position.y },
        tl: { x: corners.tl.x, y: position.y },
      };
      break;
    case "tl":
      next = {
        bl: { x: position.x, y: corners.bl.y },
        br: { x: corners.br.x, y: corners.br.y },
        tr: { x: corners.br.x, y: position.y },
        tl: { x: position.x, y: position.y },
      };
      break;
  }

  return axisAlignedCornersFromDiagonal(next.bl, next.tr);
}

/**
 * Move one edge of an axis-aligned rectangle along its free axis.
 * Opposite edge stays fixed; corners remain connected.
 */
export function moveRectangleEdge(
  corners: RectangleCorners,
  edge: RectangleEdgeKey,
  position: Point2D,
): RectangleCorners | null {
  let next: RectangleCorners;

  switch (edge) {
    case "right":
      next = {
        bl: corners.bl,
        br: { x: position.x, y: corners.br.y },
        tr: { x: position.x, y: corners.tr.y },
        tl: corners.tl,
      };
      break;
    case "left":
      next = {
        bl: { x: position.x, y: corners.bl.y },
        br: corners.br,
        tr: corners.tr,
        tl: { x: position.x, y: corners.tl.y },
      };
      break;
    case "top":
      next = {
        bl: corners.bl,
        br: corners.br,
        tr: { x: corners.tr.x, y: position.y },
        tl: { x: corners.tl.x, y: position.y },
      };
      break;
    case "bottom":
      next = {
        bl: { x: corners.bl.x, y: position.y },
        br: { x: corners.br.x, y: position.y },
        tr: corners.tr,
        tl: corners.tl,
      };
      break;
  }

  return axisAlignedCornersFromDiagonal(next.bl, next.tr);
}

export function isAxisAlignedRectangle(corners: RectangleCorners): boolean {
  const { bl, br, tr, tl } = corners;
  return (
    Math.abs(bl.y - br.y) <= TOLERANCE.coincidence &&
    Math.abs(tr.y - tl.y) <= TOLERANCE.coincidence &&
    Math.abs(bl.x - tl.x) <= TOLERANCE.coincidence &&
    Math.abs(br.x - tr.x) <= TOLERANCE.coincidence &&
    Math.abs(br.x - bl.x) > TOLERANCE.coincidence &&
    Math.abs(tl.y - bl.y) > TOLERANCE.coincidence
  );
}
