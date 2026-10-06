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
  readonly outerLoopCount: number;
  readonly holeLoopCount: number;
}
