# Sample sketches

Open from the app via **File → Sample: …**, or regenerate with:

```bash
node --experimental-strip-types scripts/generate-samples.mjs
```

| File | Intent |
|------|--------|
| `fully-constrained-rectangle.sketch.json` | Anchored rectangle (teaching / fully constrained) |
| `filleted-plate-with-hole.sketch.json` | Outer profile + hole + fillets |
| `capsule-slot.sketch.json` | Slot / capsule profile |
| `mirrored-bracket.sketch.json` | L-bracket (mirror teaching) |
| `over-constrained-line.sketch.json` | Intentional conflict demo |

Teaching samples should stay located to the world origin and carry driving dimensions so common length/radius edits do not tear topology. Load + edit survival is covered by `src/tests/samples/SampleSketches.test.ts`.
