import type { SnapCandidate } from "../sketch/selection/SnapEngine.ts";
import type { LineMetrics, RectMetrics } from "../sketch/tools/ToolTypes.ts";

/** Clear creation-tool preview chrome without touching the sketch model. */
export function clearCreationChrome(
  setActiveSnap: (snap: SnapCandidate | null) => void,
  setLineMetrics: (metrics: LineMetrics | null) => void,
  setRectMetrics: (metrics: RectMetrics | null) => void,
  setCircleRadiusMm: (radius: number | null) => void,
  setArcSweepDegrees: (sweep: number | null) => void,
  setPolygonSides: (sides: number | null) => void,
  setCreationSessionActive: (active: boolean) => void,
): void {
  setActiveSnap(null);
  setLineMetrics(null);
  setRectMetrics(null);
  setCircleRadiusMm(null);
  setArcSweepDegrees(null);
  setPolygonSides(null);
  setCreationSessionActive(false);
}
