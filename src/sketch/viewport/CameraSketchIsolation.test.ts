import { describe, expect, it } from "vitest";
import { createEmptySketch } from "../model/Sketch.ts";
import { createCamera, panCamera, zoomCameraAt } from "./Camera.ts";

describe("camera operations leave the sketch model untouched", () => {
  it("does not mutate geometry, constraints, or units while panning and zooming", () => {
    const sketch = createEmptySketch({ id: "s1", name: "Part" });
    const before = structuredClone(sketch);

    let camera = createCamera(800, 600, 2);
    camera = panCamera(camera, 120, -40);
    camera = zoomCameraAt(camera, { x: 200, y: 150 }, 1.5);
    camera = panCamera(camera, -10, 25);

    expect(sketch).toEqual(before);
    expect(camera.scale).toBeGreaterThan(2);
  });
});
