import { beforeEach, describe, expect, it } from "vitest";
import { addCoincidentToSketch } from "../commands/AddCoincidentCommand.ts";
import { prepareAddConstraint } from "../commands/AddMaintainedConstraintCommand.ts";
import {
  addLineToSketch,
  addPointToSketch,
} from "../commands/CreateGeometryCommand.ts";
import { createAddRectangleCommand } from "../commands/CreateRectangleCommand.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { parseRectangleFeature } from "../model/RectangleFeature.ts";
import { DATUM_AXIS_X_ID, DATUM_ORIGIN_ID } from "../model/SketchFrame.ts";
import { createEmptySketch } from "../model/Sketch.ts";
import {
  analyzeUnderConstrainedVisualization,
  formatUnderConstrainedSummary,
} from "./UnderConstrainedViz.ts";

describe("under-constrained visualization (Chunk 17)", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("marks both endpoints of a free line as free in X and Y", () => {
    const created = addLineToSketch(createEmptySketch(), { x: 0, y: 0 }, { x: 40, y: 10 })!;
    const viz = analyzeUnderConstrainedVisualization(created.sketch);
    expect(viz.degreesOfFreedom).toBe(4);
    expect(viz.freeHandles.length).toBeGreaterThanOrEqual(2);
    expect(viz.freeHandles.every((handle) => handle.freeX && handle.freeY)).toBe(true);
    expect(viz.summary).toMatch(/4 DOF/);
    expect(viz.summary).toMatch(/move freely|Drag amber/i);
  });

  it("after horizontal, endpoints are free vertically together (3 DOF)", () => {
    const created = addLineToSketch(createEmptySketch(), { x: 0, y: 0 }, { x: 40, y: 0 })!;
    const added = prepareAddConstraint(created.sketch, {
      type: "horizontal",
      references: [{ entityId: created.line.id, role: "entity" }],
    });
    expect(added.ok).toBe(true);
    if (!added.ok) {
      return;
    }
    const viz = analyzeUnderConstrainedVisualization(added.sketch);
    expect(viz.degreesOfFreedom).toBe(3);
    expect(viz.freeHandles.length).toBeGreaterThan(0);
    expect(viz.summary).toMatch(/3 DOF/);
  });

  it("point on X axis is free horizontally only", () => {
    const created = addPointToSketch(createEmptySketch(), { x: 12, y: 0 });
    const sketch = addCoincidentToSketch(
      created.sketch,
      { entityId: created.point.id, role: "position" },
      { entityId: DATUM_AXIS_X_ID, role: "entity" },
    )!;
    const viz = analyzeUnderConstrainedVisualization(sketch);
    expect(viz.degreesOfFreedom).toBe(1);
    expect(viz.freeHandles).toHaveLength(1);
    expect(viz.freeHandles[0]).toMatchObject({
      entityId: created.point.id,
      freeX: true,
      freeY: false,
    });
    expect(viz.summary).toMatch(/horizontally/i);
  });

  it("fully constrained rectangle has no free-handle markers", () => {
    let sketch = createAddRectangleCommand({ x: 0, y: 0 }, { x: 40, y: 20 })!.apply(
      createEmptySketch(),
    );
    const feature = sketch.constraints
      .map(parseRectangleFeature)
      .find((item) => item !== null)!;
    sketch = addCoincidentToSketch(
      sketch,
      { entityId: feature.corners.bl!, role: "position" },
      { entityId: DATUM_ORIGIN_ID, role: "position" },
    )!;
    for (const edgeId of [feature.edges.bottom, feature.edges.left]) {
      const added = prepareAddConstraint(sketch, {
        type: "length",
        references: [{ entityId: edgeId, role: "entity" }],
      });
      expect(added.ok).toBe(true);
      if (!added.ok) {
        return;
      }
      sketch = added.sketch;
    }
    const viz = analyzeUnderConstrainedVisualization(sketch);
    expect(viz.degreesOfFreedom).toBe(0);
    expect(viz.freeHandles).toEqual([]);
    expect(viz.summary).toMatch(/fully constrained/i);
  });

  it("formats summary without inventing DOF from handle counts alone", () => {
    expect(formatUnderConstrainedSummary(2, [])).toMatch(/2 DOF remain/);
  });
});
