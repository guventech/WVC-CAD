import { beforeEach, describe, expect, it } from "vitest";
import { addLineToSketch, createAddCircleCommand } from "../commands/CreateGeometryCommand.ts";
import { createAddRectangleCommand } from "../commands/CreateRectangleCommand.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { createEmptySketch } from "../model/Sketch.ts";
import {
  analyzeSketchDiagnostics,
  formatDiagnosticsLines,
} from "./SketchDiagnostics.ts";

describe("SketchDiagnostics (Chunk 22)", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("reports open endpoints and no closed profile for a free line", () => {
    let sketch = createEmptySketch();
    sketch = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 40, y: 0 })!.sketch;
    const report = analyzeSketchDiagnostics(sketch);

    expect(report.summary.openEndpointCount).toBe(2);
    expect(report.summary.closedProfileDetected).toBe(false);
    expect(report.findings.some((f) => f.code === "open-endpoint")).toBe(true);
    expect(report.findings.some((f) => f.code === "open-profile")).toBe(true);
    expect(report.findings.some((f) => f.code === "remaining-dof")).toBe(true);
  });

  it("detects a closed rectangle profile", () => {
    const add = createAddRectangleCommand({ x: 0, y: 0 }, { x: 100, y: 50 })!;
    const sketch = add.apply(createEmptySketch());
    const report = analyzeSketchDiagnostics(sketch);

    expect(report.summary.openEndpointCount).toBe(0);
    expect(report.summary.closedProfileDetected).toBe(true);
    expect(report.findings.some((f) => f.code === "closed-profile")).toBe(true);
    expect(report.findings.some((f) => f.code === "self-intersection")).toBe(
      false,
    );
  });

  it("treats a solid circle as a closed profile", () => {
    const add = createAddCircleCommand({ x: 0, y: 0 }, { x: 20, y: 0 })!;
    const sketch = add.apply(createEmptySketch());
    const report = analyzeSketchDiagnostics(sketch);
    expect(report.summary.closedProfileDetected).toBe(true);
  });

  it("flags duplicate lines", () => {
    let sketch = createEmptySketch();
    sketch = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 10, y: 0 })!.sketch;
    sketch = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 10, y: 0 })!.sketch;
    const report = analyzeSketchDiagnostics(sketch);
    expect(report.findings.some((f) => f.code === "duplicate-geometry")).toBe(
      true,
    );
  });

  it("flags crossing solid lines as self-intersections", () => {
    let sketch = createEmptySketch();
    sketch = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 10, y: 10 })!.sketch;
    sketch = addLineToSketch(sketch, { x: 0, y: 10 }, { x: 10, y: 0 })!.sketch;
    const report = analyzeSketchDiagnostics(sketch);
    expect(report.summary.selfIntersectionCount).toBe(1);
    expect(report.findings.some((f) => f.code === "self-intersection")).toBe(
      true,
    );
  });

  it("flags zero-radius circles", () => {
    const sketch = {
      ...createEmptySketch(),
      geometry: [
        {
          id: "circle-bad",
          type: "circle" as const,
          center: { x: 0, y: 0 },
          radius: 0,
          construction: false,
        },
      ],
    };
    const report = analyzeSketchDiagnostics(sketch);
    expect(report.findings.some((f) => f.code === "zero-radius-circle")).toBe(
      true,
    );
  });

  it("formats a readable analysis report", () => {
    let sketch = createEmptySketch();
    sketch = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 20, y: 0 })!.sketch;
    const lines = formatDiagnosticsLines(analyzeSketchDiagnostics(sketch));
    expect(lines[0]).toBe("Sketch Analysis");
    expect(lines.some((line) => line.includes("Geometry"))).toBe(true);
    expect(lines.some((line) => line.includes("Constraints"))).toBe(true);
    expect(lines.some((line) => line.includes("Profiles"))).toBe(true);
    expect(lines.some((line) => line.includes("open endpoint"))).toBe(true);
  });

  it("warns when construction touches a solid wire", () => {
    let sketch = createEmptySketch();
    sketch = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 40, y: 0 })!.sketch;
    sketch = addLineToSketch(
      sketch,
      { x: 0, y: 0 },
      { x: 0, y: 20 },
      { construction: true },
    )!.sketch;
    const report = analyzeSketchDiagnostics(sketch);
    expect(
      report.findings.some((f) => f.code === "construction-in-profile"),
    ).toBe(true);
  });
});
