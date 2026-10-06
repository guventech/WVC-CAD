export interface SketchSettings {
  /** When true, the viewport draws a scale-aware millimetre grid. */
  readonly gridVisible: boolean;
}

export function createDefaultSketchSettings(): SketchSettings {
  return {
    gridVisible: true,
  };
}
