import type { Constraint } from "./Constraint.ts";
import type { Geometry } from "./Geometry.ts";
import {
  createDefaultSketchFrame,
  type SketchFrame,
} from "./SketchFrame.ts";
import {
  createDefaultSketchSettings,
  type SketchSettings,
} from "./SketchSettings.ts";
import {
  SKETCH_SCHEMA_VERSION,
  type SketchUnits,
} from "../serialization/SketchSchema.ts";

export interface Sketch {
  readonly id: string;
  readonly name: string;
  readonly units: SketchUnits;
  readonly geometry: readonly Geometry[];
  readonly constraints: readonly Constraint[];
  /** Fixed origin + in-plane axes (not in `geometry`; never movable/deletable). */
  readonly frame: SketchFrame;
  readonly settings: SketchSettings;
  readonly version: number;
}

export function createEmptySketch(options?: {
  readonly id?: string;
  readonly name?: string;
}): Sketch {
  return {
    id: options?.id ?? "sketch-1",
    name: options?.name ?? "Sketch 1",
    units: "mm",
    geometry: [],
    constraints: [],
    frame: createDefaultSketchFrame(),
    settings: createDefaultSketchSettings(),
    version: SKETCH_SCHEMA_VERSION,
  };
}
