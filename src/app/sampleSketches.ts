export type SampleSketchInfo = {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly path: string;
};

/** Bundled example sketches under `public/samples/`. */
export const SAMPLE_SKETCHES: readonly SampleSketchInfo[] = [
  {
    id: "anchored-rectangle",
    label: "Anchored rectangle",
    description: "100×50 mm rectangle with corner at the origin",
    path: "/samples/fully-constrained-rectangle.sketch.json",
  },
  {
    id: "filleted-plate",
    label: "Filleted plate with hole",
    description: "Rectangle, one fillet, and an inner circle",
    path: "/samples/filleted-plate-with-hole.sketch.json",
  },
  {
    id: "capsule-slot",
    label: "Capsule slot",
    description: "Slot create tool result",
    path: "/samples/capsule-slot.sketch.json",
  },
  {
    id: "mirrored-bracket",
    label: "Mirrored bracket",
    description: "L-bracket mirrored about the Y-axis",
    path: "/samples/mirrored-bracket.sketch.json",
  },
  {
    id: "over-constrained-line",
    label: "Over-constrained line",
    description: "Conflicting lengths — shows inconsistent solver status",
    path: "/samples/over-constrained-line.sketch.json",
  },
] as const;
