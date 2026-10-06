import { describe, expect, it } from "vitest";
import { createEmptySketch } from "../../sketch/model/Sketch.ts";
import { createDefaultSketchFrame } from "../../sketch/model/SketchFrame.ts";
import { SKETCH_SCHEMA_VERSION } from "../../sketch/serialization/SketchSchema.ts";

describe("createEmptySketch", () => {
  it("creates an empty millimetre sketch with a world datum frame", () => {
    const sketch = createEmptySketch({ id: "s1", name: "Part" });

    expect(sketch).toEqual({
      id: "s1",
      name: "Part",
      units: "mm",
      geometry: [],
      constraints: [],
      frame: createDefaultSketchFrame(),
      settings: { gridVisible: true },
      version: SKETCH_SCHEMA_VERSION,
    });
  });

  it("uses a stable default identity", () => {
    expect(createEmptySketch()).toEqual(createEmptySketch());
  });
});
