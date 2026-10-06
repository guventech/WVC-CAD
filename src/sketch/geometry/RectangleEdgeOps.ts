import type { EntityId } from "../model/Geometry.ts";
import type { Sketch } from "../model/Sketch.ts";
import { TOLERANCE } from "./GeometryMath.ts";
import {
  cornerFeaturesTopologyIntact,
  findLine,
  rebuildAllCornerFeatures,
  translateCornerFeaturesTouching,
  translateLineInSketch,
} from "./FilletChamferOpsShared.ts";

/**
 * Size a rectangle by moving one edge to an axis Offset target (opposite edge
 * stays pinned). Rebuilds fillets/chamfers so blends stay tangent.
 * Use only when another same-axis Offset already exists (locate vs size).
 */
export function applyAxisOffsetToRectangleEdge(
  sketch: Sketch,
  edgeId: EntityId,
  axis: "coordinate-x" | "coordinate-y",
  value: number,
): Sketch | null {
  const line = findLine(sketch, edgeId);
  if (line === null) {
    return null;
  }
  const current = axis === "coordinate-x" ? line.start.x : line.start.y;
  const deltaVal = value - current;
  if (Math.abs(deltaVal) <= TOLERANCE.coincidence) {
    const rebuilt = rebuildAllCornerFeatures(sketch);
    return cornerFeaturesTopologyIntact(rebuilt) ? rebuilt : null;
  }
  const offset =
    axis === "coordinate-x"
      ? { x: deltaVal, y: 0 }
      : { x: 0, y: deltaVal };
  const shifted = translateLineInSketch(sketch, edgeId, offset);
  if (shifted === null) {
    return null;
  }
  const withBlends = translateCornerFeaturesTouching(shifted, edgeId, offset);
  const rebuilt = rebuildAllCornerFeatures(withBlends);
  if (!cornerFeaturesTopologyIntact(rebuilt)) {
    return null;
  }
  return rebuilt;
}
