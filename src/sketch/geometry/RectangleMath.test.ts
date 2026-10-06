import { describe, expect, it } from "vitest";
import {
  axisAlignedCornersFromDiagonal,
  isAxisAlignedRectangle,
  moveRectangleCorner,
  moveRectangleEdge,
  rectangleMetrics,
} from "./RectangleMath.ts";

describe("RectangleMath", () => {
  it("builds axis-aligned corners from a diagonal", () => {
    const corners = axisAlignedCornersFromDiagonal(
      { x: 10, y: 40 },
      { x: 50, y: 10 },
    );

    expect(corners).toEqual({
      bl: { x: 10, y: 10 },
      br: { x: 50, y: 10 },
      tr: { x: 50, y: 40 },
      tl: { x: 10, y: 40 },
    });
    expect(rectangleMetrics(corners!)).toEqual({
      widthMm: 40,
      heightMm: 30,
    });
    expect(isAxisAlignedRectangle(corners!)).toBe(true);
  });

  it("rejects zero-area diagonals", () => {
    expect(
      axisAlignedCornersFromDiagonal({ x: 5, y: 1 }, { x: 5, y: 9 }),
    ).toBeNull();
    expect(
      axisAlignedCornersFromDiagonal({ x: 1, y: 5 }, { x: 9, y: 5 }),
    ).toBeNull();
  });

  it("keeps horizontal and vertical edges when dragging a corner", () => {
    const corners = axisAlignedCornersFromDiagonal(
      { x: 0, y: 0 },
      { x: 100, y: 50 },
    )!;

    const moved = moveRectangleCorner(corners, "tr", { x: 80, y: 70 });
    expect(moved).not.toBeNull();
    expect(isAxisAlignedRectangle(moved!)).toBe(true);
    expect(moved).toEqual({
      bl: { x: 0, y: 0 },
      br: { x: 80, y: 0 },
      tr: { x: 80, y: 70 },
      tl: { x: 0, y: 70 },
    });
  });

  it("moves one edge while keeping the opposite edge fixed", () => {
    const corners = axisAlignedCornersFromDiagonal(
      { x: 0, y: 0 },
      { x: 100, y: 50 },
    )!;

    const right = moveRectangleEdge(corners, "right", { x: 120, y: 999 });
    expect(right).toEqual({
      bl: { x: 0, y: 0 },
      br: { x: 120, y: 0 },
      tr: { x: 120, y: 50 },
      tl: { x: 0, y: 50 },
    });

    const top = moveRectangleEdge(corners, "top", { x: 999, y: 80 });
    expect(top).toEqual({
      bl: { x: 0, y: 0 },
      br: { x: 100, y: 0 },
      tr: { x: 100, y: 80 },
      tl: { x: 0, y: 80 },
    });
  });

  it("rejects edge moves that collapse the rectangle", () => {
    const corners = axisAlignedCornersFromDiagonal(
      { x: 0, y: 0 },
      { x: 100, y: 50 },
    )!;
    expect(moveRectangleEdge(corners, "right", { x: 0, y: 0 })).toBeNull();
    expect(moveRectangleEdge(corners, "top", { x: 0, y: 0 })).toBeNull();
  });
});
