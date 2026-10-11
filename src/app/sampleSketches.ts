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
    description: "Located 120×80 plate, BL fillet, fixed ⌀30 hole",
    path: "/samples/filleted-plate-with-hole.sketch.json",
  },
  {
    id: "capsule-slot",
    label: "Capsule slot",
    description: "Slot at origin with pitch 80 mm and R20 (still some free DOF)",
    path: "/samples/capsule-slot.sketch.json",
  },
  {
    id: "mirrored-bracket",
    label: "L-bracket",
    description: "Fully constrained L at the origin (60×40 mm)",
    path: "/samples/mirrored-bracket.sketch.json",
  },
  {
    id: "over-constrained-line",
    label: "Over-constrained line",
    description: "Intentional conflicting lengths — inconsistent solver demo",
    path: "/samples/over-constrained-line.sketch.json",
  },
] as const;
