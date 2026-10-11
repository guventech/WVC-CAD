import type { Constraint } from "../model/Constraint.ts";
import type { Geometry } from "../model/Geometry.ts";
import type { SketchFrame } from "../model/SketchFrame.ts";
import type { SketchSettings } from "../model/SketchSettings.ts";

/** Current on-disk / interchange schema version. */
export const SKETCH_SCHEMA_VERSION = 1;

export const SKETCH_UNITS = "mm" as const;

export type SketchUnits = typeof SKETCH_UNITS;

/** Default download / open extension (JSON text). */
export const SKETCH_FILE_EXTENSION = ".sketch.json";

export const SKETCH_FILE_ACCEPT = ".sketch.json,application/json";

export interface SketchDocumentMetadata {
  readonly savedAt?: string;
  readonly app?: string;
}

/**
 * Versioned interchange document for save/load.
 * Units are always millimetres; loaders must reject other unit strings.
 */
export interface SketchDocument {
  readonly schemaVersion: number;
  readonly units: SketchUnits;
  readonly id: string;
  readonly name: string;
  readonly geometry: readonly Geometry[];
  readonly constraints: readonly Constraint[];
  readonly settings: SketchSettings;
  /** Optional; omitted files use the default world frame on load. */
  readonly frame?: SketchFrame;
  readonly metadata?: SketchDocumentMetadata;
}

export const SKETCH_APP_NAME = "wvc-cad";
