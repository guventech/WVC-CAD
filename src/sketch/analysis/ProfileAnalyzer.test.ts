import { beforeEach, describe, expect, it } from "vitest";
import {
  addLineToSketch,
  addCircleToSketch,
  createAddCircleCommand,
} from "../commands/CreateGeometryCommand.ts";
import { createAddRectangleCommand } from "../commands/CreateRectangleCommand.ts";
import { applyFilletLines } from "../geometry/FilletChamferOps.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { parseRectangleFeature } from "../model/RectangleFeature.ts";
import { createEmptySketch } from "../model/Sketch.ts";
import { analyzeProfiles, isReadyForPad } from "./ProfileAnalyzer.ts";
import { analyzeSketchDiagnostics } from "./SketchDiagnostics.ts";

describe("ProfileAnalyzer (Chunk 23)", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("finds one closed outer loop for a rectangle", () => {
    const add = createAddRectangleCommand({ x: 0, y: 0 }, { x: 100, y: 50 })!;
    const sketch = add.apply(createEmptySketch());
    const analysis = analyzeProfiles(sketch);

    expect(analysis.outerLoopCount).toBe(1);
    expect(analysis.holeLoopCount).toBe(0);
    expect(analysis.loops[0]?.closed).toBe(true);
    expect(analysis.loops[0]?.entityIds).toHaveLength(4);
    expect(analysis.loops[0]?.area).toBeCloseTo(5000, 0);
    expect(analysis.openEntityIds).toHaveLength(0);
  });

  it("reports open wire for a single line", () => {
    let sketch = createEmptySketch();
    sketch = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 40, y: 0 })!.sketch;
    const analysis = analyzeProfiles(sketch);

    expect(analysis.outerLoopCount).toBe(0);
    expect(analysis.openEntityIds).toHaveLength(1);
  });

  it("Fixture F — three connected lines form an open chain", () => {
    let sketch = createEmptySketch();
    sketch = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 40, y: 0 })!.sketch;
    sketch = addLineToSketch(sketch, { x: 40, y: 0 }, { x: 40, y: 30 })!.sketch;
    sketch = addLineToSketch(sketch, { x: 40, y: 30 }, { x: 0, y: 30 })!.sketch;
    const analysis = analyzeProfiles(sketch);

    expect(analysis.outerLoopCount).toBe(0);
    expect(analysis.openEntityIds).toHaveLength(3);
  });

  it("Fixture G — outer circle with inner hole loop", () => {
    let sketch = createEmptySketch();
    sketch = addCircleToSketch(sketch, { x: 0, y: 0 }, 30)!.sketch;
    sketch = addCircleToSketch(sketch, { x: 0, y: 0 }, 10)!.sketch;
    const analysis = analyzeProfiles(sketch);

    expect(analysis.outerLoopCount).toBe(1);
    expect(analysis.holeLoopCount).toBe(1);
    const hole = analysis.loops.find((loop) => loop.parentLoopId !== undefined);
    const outer = analysis.loops.find((loop) => loop.parentLoopId === undefined);
    expect(hole).toBeDefined();
    expect(outer).toBeDefined();
    expect(hole!.parentLoopId).toBe(outer!.id);
    expect(hole!.area).toBeLessThan(outer!.area);
  });

  it("detects a circle as a closed profile loop", () => {
    const add = createAddCircleCommand({ x: 5, y: 5 }, { x: 25, y: 5 })!;
    const sketch = add.apply(createEmptySketch());
    const analysis = analyzeProfiles(sketch);
    expect(analysis.outerLoopCount).toBe(1);
    expect(analysis.loops[0]?.entityIds).toHaveLength(1);
    expect(analysis.loops[0]?.area).toBeCloseTo(Math.PI * 400, 0);
  });

  it("counts line self-intersections", () => {
    let sketch = createEmptySketch();
    sketch = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 10, y: 10 })!.sketch;
    sketch = addLineToSketch(sketch, { x: 0, y: 10 }, { x: 10, y: 0 })!.sketch;
    expect(analyzeProfiles(sketch).selfIntersectionCount).toBe(1);
  });

  it("detects a fully filleted rectangle as one closed outer profile", () => {
    const add = createAddRectangleCommand({ x: 0, y: 0 }, { x: 100, y: 50 })!;
    let sketch = add.apply(createEmptySketch());
    const rect = parseRectangleFeature(
      sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;

    for (const corner of [
      { a: rect.edges.bottom, b: rect.edges.right, pick: { x: 90, y: 10 } },
      { a: rect.edges.right, b: rect.edges.top, pick: { x: 90, y: 40 } },
      { a: rect.edges.top, b: rect.edges.left, pick: { x: 10, y: 40 } },
      { a: rect.edges.left, b: rect.edges.bottom, pick: { x: 10, y: 10 } },
    ] as const) {
      const outcome = applyFilletLines(sketch, corner.a, corner.b, corner.pick, 8);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) {
        return;
      }
      sketch = outcome.sketch;
    }

    const analysis = analyzeProfiles(sketch);
    expect(analysis.outerLoopCount).toBe(1);
    expect(analysis.holeLoopCount).toBe(0);
    expect(analysis.openEntityIds).toHaveLength(0);
    expect(analysis.loops[0]?.entityIds).toHaveLength(8); // 4 lines + 4 arcs
    expect(analysis.loops[0]?.area).toBeGreaterThan(4000);

    const report = analyzeSketchDiagnostics(sketch);
    expect(report.summary.closedProfileDetected).toBe(true);
    expect(report.summary.readyForPad).toBe(true);
    expect(report.findings.some((f) => f.code === "closed-profile")).toBe(true);
    expect(report.findings.some((f) => f.code === "ready-for-pad")).toBe(true);
    expect(report.findings.some((f) => f.code === "open-profile")).toBe(false);
  });

  it("excludes construction geometry from solid profiles", () => {
    const add = createAddRectangleCommand(
      { x: 0, y: 0 },
      { x: 40, y: 30 },
      { construction: true },
    )!;
    const sketch = add.apply(createEmptySketch());
    const analysis = analyzeProfiles(sketch);
    expect(analysis.outerLoopCount).toBe(0);
    expect(analysis.openEntityIds).toHaveLength(0);
    expect(analysis.loops).toHaveLength(0);
  });

  it("isReadyForPad is false for an open chain", () => {
    let sketch = createEmptySketch();
    sketch = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 40, y: 0 })!.sketch;
    sketch = addLineToSketch(sketch, { x: 40, y: 0 }, { x: 40, y: 30 })!.sketch;
    expect(isReadyForPad(analyzeProfiles(sketch))).toBe(false);
  });

  it("isReadyForPad is true for a solid rectangle", () => {
    const sketch = createAddRectangleCommand(
      { x: 0, y: 0 },
      { x: 100, y: 50 },
    )!.apply(createEmptySketch());
    expect(isReadyForPad(analyzeProfiles(sketch))).toBe(true);
  });

  it("Pad handoff: self-intersecting wires are not ready for pad", () => {
    let sketch = createEmptySketch();
    sketch = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 10, y: 10 })!.sketch;
    sketch = addLineToSketch(sketch, { x: 0, y: 10 }, { x: 10, y: 0 })!.sketch;
    const analysis = analyzeProfiles(sketch);
    expect(analysis.selfIntersectionCount).toBeGreaterThan(0);
    expect(isReadyForPad(analysis)).toBe(false);
  });

  it("Pad handoff: construction beside a solid rectangle does not block pad", () => {
    let sketch = createAddRectangleCommand(
      { x: 0, y: 0 },
      { x: 60, y: 40 },
    )!.apply(createEmptySketch());
    sketch = addLineToSketch(
      sketch,
      { x: -20, y: 0 },
      { x: -20, y: 40 },
      { construction: true },
    )!.sketch;
    const analysis = analyzeProfiles(sketch);
    expect(analysis.outerLoopCount).toBe(1);
    expect(isReadyForPad(analysis)).toBe(true);
  });

  it("Pad handoff: readyForPad is topology-only (under-constrained still ok)", () => {
    const sketch = createAddRectangleCommand(
      { x: 0, y: 0 },
      { x: 80, y: 40 },
    )!.apply(createEmptySketch());
    const analysis = analyzeProfiles(sketch);
    expect(isReadyForPad(analysis)).toBe(true);
    // No world fix / sizes — still under-constrained for the solver.
    const report = analyzeSketchDiagnostics(sketch);
    expect(report.solverResult.degreesOfFreedom).toBeGreaterThan(0);
    expect(report.summary.readyForPad).toBe(true);
  });
});
