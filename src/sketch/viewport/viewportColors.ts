export const VIEWPORT_COLORS = {
  background: "#1a1a1a",
  minorGrid: "#2a2a2a",
  majorGrid: "#333333",
  xAxis: "#c05050",
  yAxis: "#50a050",
  origin: "#d4d4d4",
  preview: "#4fc1ff",
  snap: "#ffd866",
  inference: "#7fd99a",
  geometry: "#c8c8c8",
  construction: "#6f8f9f",
  /** Fully constrained solid geometry (no free solver variables). */
  fullyConstrained: "#3dcc7a",
  selected: "#ffa657",
  handle: "#e6e6e6",
  dimension: "#9cdcfe",
  constraintGlyph: "#b5cea8",
  /** Under-constrained free-handle markers (Chunk 17). */
  dof: "#e6a23c",
} as const;
