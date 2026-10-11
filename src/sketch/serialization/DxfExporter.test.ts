/**
 * DXF is geometry-only interchange (ADR-056). Constraints, dimensions, and
 * features are not represented — parametric truth remains `.sketch.json`.
 * DXF import is not supported in this alpha.
 */
import { describe, expect, it } from "vitest";
import { prepareAddConstraint } from "../commands/AddMaintainedConstraintCommand.ts";
import {
  addArcToSketch,
  addCircleToSketch,
  addLineToSketch,
  addPointToSketch,
} from "../commands/CreateGeometryCommand.ts";
import { createEmptySketch } from "../model/Sketch.ts";
import {
  dxfDownloadFileName,
  exportSketchToDxf,
  tryExportSketchToDxf,
} from "./DxfExporter.ts";

describe("DxfExporter", () => {
  it("exports an empty sketch as a valid R12 shell ending in EOF", () => {
    const dxf = exportSketchToDxf(createEmptySketch());
    expect(dxf).toContain("AC1009");
    expect(dxf).toContain("$INSUNITS");
    expect(dxf).toMatch(/\n70\n4\n/); // millimeters
    expect(dxf.trimEnd().endsWith("EOF")).toBe(true);
  });

  it("exports a single line as a LINE entity with world coordinates", () => {
    const created = addLineToSketch(
      createEmptySketch(),
      { x: 1.5, y: 2.25 },
      { x: 10, y: -3 },
    )!;
    const dxf = exportSketchToDxf(created.sketch);
    expect(dxf).toContain("LINE");
    expect(dxf).toContain("1.5");
    expect(dxf).toContain("2.25");
    expect(dxf).toContain("10");
    expect(dxf).toContain("-3");
  });

  it("exports a circle as a CIRCLE entity with center and radius", () => {
    const created = addCircleToSketch(createEmptySketch(), { x: 5, y: 7 }, 3.5)!;
    const dxf = exportSketchToDxf(created.sketch);
    expect(dxf).toContain("CIRCLE");
    expect(dxf).toMatch(/\n10\n5\n/);
    expect(dxf).toMatch(/\n20\n7\n/);
    expect(dxf).toMatch(/\n40\n3\.5\n/);
  });

  it("exports an arc as an ARC entity with degrees", () => {
    const created = addArcToSketch(
      createEmptySketch(),
      { x: 0, y: 0 },
      4,
      0,
      Math.PI / 2,
    )!;
    const dxf = exportSketchToDxf(created.sketch);
    expect(dxf).toContain("ARC");
    expect(dxf).toMatch(/\n40\n4\n/);
    expect(dxf).toMatch(/\n50\n0\n/);
    expect(dxf).toMatch(/\n51\n90\n/);
  });

  it("exports arcs that cross 0° with normalized CCW degree bounds", () => {
    const created = addArcToSketch(
      createEmptySketch(),
      { x: 0, y: 0 },
      10,
      (3 * Math.PI) / 2,
      Math.PI / 4,
    )!;
    const pairs = parseGroupPairs(exportSketchToDxf(created.sketch));
    const arc = entityPairs(pairs, "ARC");
    expect(groupValue(arc, 50)).toBe("270");
    expect(groupValue(arc, 51)).toBe("45");
  });

  it("exports line, circle, arc, and point entities together", () => {
    let sketch = createEmptySketch();
    sketch = addPointToSketch(sketch, { x: 1, y: 2 }).sketch;
    sketch = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 10, y: 0 })!.sketch;
    sketch = addCircleToSketch(sketch, { x: 5, y: 5 }, 3)!.sketch;
    sketch = addArcToSketch(sketch, { x: 0, y: 0 }, 4, 0, Math.PI / 2)!.sketch;

    const dxf = exportSketchToDxf(sketch);
    expect(dxf).toContain("POINT");
    expect(dxf).toContain("LINE");
    expect(dxf).toContain("CIRCLE");
    expect(dxf).toContain("ARC");
    expect(dxf.trimEnd().endsWith("EOF")).toBe(true);
  });

  it("puts construction geometry on the CONSTRUCTION layer", () => {
    const created = addLineToSketch(
      createEmptySketch(),
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { construction: true },
    )!;
    const dxf = exportSketchToDxf(created.sketch);
    expect(dxf).toContain("CONSTRUCTION");
    const lineIdx = dxf.indexOf("\n0\nLINE\n");
    expect(lineIdx).toBeGreaterThanOrEqual(0);
    expect(dxf.slice(lineIdx, lineIdx + 80)).toContain("CONSTRUCTION");
  });

  it("puts solid geometry on layer 0", () => {
    const created = addCircleToSketch(createEmptySketch(), { x: 0, y: 0 }, 2)!;
    const pairs = parseGroupPairs(exportSketchToDxf(created.sketch));
    const circle = entityPairs(pairs, "CIRCLE");
    expect(groupValue(circle, 8)).toBe("0");
  });

  it("does not encode constraints or dimensions in DXF", () => {
    let sketch = addLineToSketch(
      createEmptySketch(),
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    )!.sketch;
    const length = prepareAddConstraint(sketch, {
      type: "length",
      references: [{ entityId: sketch.geometry[0]!.id, role: "entity" }],
      value: 10,
    });
    expect(length.ok).toBe(true);
    if (length.ok) {
      sketch = length.sketch;
    }
    expect(sketch.constraints.length).toBeGreaterThan(0);

    const dxf = exportSketchToDxf(sketch);
    expect(dxf.toUpperCase()).not.toContain("CONSTRAINT");
    expect(dxf.toUpperCase()).not.toContain("DIMENSION");
    expect(dxf).not.toMatch(/length|horizontal|coincident/i);
  });

  it("round-trips line endpoints through DXF group codes (export-only parse)", () => {
    const created = addLineToSketch(
      createEmptySketch(),
      { x: 12, y: 34 },
      { x: 56, y: 78 },
    )!;
    const pairs = parseGroupPairs(exportSketchToDxf(created.sketch));
    const line = entityPairs(pairs, "LINE");
    expect(groupValue(line, 10)).toBe("12");
    expect(groupValue(line, 20)).toBe("34");
    expect(groupValue(line, 11)).toBe("56");
    expect(groupValue(line, 21)).toBe("78");
  });

  it("round-trips point, circle, and arc group codes", () => {
    let sketch = createEmptySketch();
    sketch = addPointToSketch(sketch, { x: 3, y: 4 }).sketch;
    sketch = addCircleToSketch(sketch, { x: 1, y: 2 }, 5)!.sketch;
    sketch = addArcToSketch(sketch, { x: 0, y: 0 }, 8, -Math.PI / 2, 0)!.sketch;

    const pairs = parseGroupPairs(exportSketchToDxf(sketch));
    const point = entityPairs(pairs, "POINT");
    expect(groupValue(point, 10)).toBe("3");
    expect(groupValue(point, 20)).toBe("4");

    const circle = entityPairs(pairs, "CIRCLE");
    expect(groupValue(circle, 10)).toBe("1");
    expect(groupValue(circle, 20)).toBe("2");
    expect(groupValue(circle, 40)).toBe("5");

    const arc = entityPairs(pairs, "ARC");
    expect(groupValue(arc, 40)).toBe("8");
    expect(groupValue(arc, 50)).toBe("270");
    expect(groupValue(arc, 51)).toBe("0");
  });

  it("fails export for non-finite geometry instead of writing a silent zero file", () => {
    const sketch = {
      ...createEmptySketch(),
      geometry: [
        {
          id: "line-bad",
          type: "line" as const,
          start: { x: Number.NaN, y: 0 },
          end: { x: 1, y: 0 },
          construction: false,
        },
      ],
    };
    const outcome = tryExportSketchToDxf(sketch);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) {
      return;
    }
    expect(outcome.reason).toMatch(/non-finite/i);
    expect(() => exportSketchToDxf(sketch)).toThrow(/non-finite/i);
  });

  it("builds a sanitized .dxf download name", () => {
    expect(dxfDownloadFileName("My Part")).toBe("my-part.dxf");
    expect(dxfDownloadFileName("  ")).toBe("sketch.dxf");
    expect(dxfDownloadFileName('a<>:"/\\|?*b')).toBe("a-b.dxf");
  });
});

function parseGroupPairs(dxf: string): Array<{ code: number; value: string }> {
  const lines = dxf.trimEnd().split("\n");
  const pairs: Array<{ code: number; value: string }> = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    pairs.push({ code: Number(lines[i]), value: lines[i + 1]! });
  }
  return pairs;
}

function entityPairs(
  pairs: Array<{ code: number; value: string }>,
  type: string,
): Array<{ code: number; value: string }> {
  const start = pairs.findIndex((p) => p.code === 0 && p.value === type);
  expect(start).toBeGreaterThanOrEqual(0);
  const slice: Array<{ code: number; value: string }> = [];
  for (let i = start; i < pairs.length; i += 1) {
    if (i > start && pairs[i]!.code === 0) {
      break;
    }
    slice.push(pairs[i]!);
  }
  return slice;
}

function groupValue(
  pairs: Array<{ code: number; value: string }>,
  code: number,
): string | undefined {
  return pairs.find((p) => p.code === code)?.value;
}
