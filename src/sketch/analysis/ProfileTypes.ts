import type { EntityId } from "../model/Geometry.ts";

export type LoopOrientation = "CW" | "CCW";

/** Closed or open wire loop for downstream 3D profile features (Chunk 23). */
export interface ProfileLoop {
  readonly id: string;
  readonly entityIds: readonly EntityId[];
  readonly closed: boolean;
  readonly orientation: LoopOrientation;
  /** Absolute area in mm² (0 for open chains). */
  readonly area: number;
  /** Set when this loop is a hole inside another loop. */
  readonly parentLoopId?: string;
}

export interface ProfileAnalysis {
  readonly loops: readonly ProfileLoop[];
  /** Solid profile entities not part of a closed loop. */
  readonly openEntityIds: readonly EntityId[];
  readonly selfIntersectionCount: number;
  /** Wire junctions where more than two solid edges meet (non-manifold). */
  readonly nonManifoldJunctionCount: number;
  readonly outerLoopCount: number;
  readonly holeLoopCount: number;
}

/**
 * Topology gate for a future Pad: one outer solid loop, no open solid wire,
 * no self-intersections, no non-manifold junctions. Construction is already
 * excluded by `analyzeProfiles`. Constraint DOF is intentionally not required
 * (CAD pads often accept under-constrained sketches).
 */
export function isReadyForPad(analysis: ProfileAnalysis): boolean {
  return (
    analysis.outerLoopCount === 1 &&
    analysis.openEntityIds.length === 0 &&
    analysis.selfIntersectionCount === 0 &&
    analysis.nonManifoldJunctionCount === 0
  );
}
