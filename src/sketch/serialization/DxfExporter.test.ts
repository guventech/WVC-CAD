import { describe, expect, it } from "vitest";
import {
  addArcToSketch,
  addCircleToSketch,
  addLineToSketch,
  addPointToSketch,
} from "../commands/CreateGeometryCommand.ts";
import { createEmptySketch } from "../model/Sketch.ts";
import { dxfDownloadFileName, exportSketchToDxf } from "./DxfExporter.ts";

describe("DxfExporter", () => {
  it("exports line, circle, arc, and point entities", () => {
    let sketch = createEmptySketch();
    sketch = addPointToSketch(sketch, { x: 1, y: 2 }).sketch;
    sketch = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 10, y: 0 })!.sketch;
    sketch = addCircleToSketch(sketch, { x: 5, y: 5 }, 3)!.sketch;
    sketch = addArcToSketch(sketch, { x: 0, y: 0 }, 4, 0, Math.PI / 2)!.sketch;

    const dxf = exportSketchToDxf(sketch);
    expect(dxf).toContain("AC1009");
    expect(dxf).toContain("POINT");
    expect(dxf).toContain("LINE");
    expect(dxf).toContain("CIRCLE");
    expect(dxf).toContain("ARC");
    expect(dxf.trimEnd().endsWith("EOF")).toBe(true);
  });

  it("puts construction geometry on CONSTRUCTION layer", () => {
    const created = addLineToSketch(
      createEmptySketch(),
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { construction: true },
    )!;
    const dxf = exportSketchToDxf(created.sketch);
    expect(dxf).toContain("CONSTRUCTION");
  });

  it("builds a .dxf download name", () => {
    expect(dxfDownloadFileName("My Part")).toBe("my-part.dxf");
  });
});
