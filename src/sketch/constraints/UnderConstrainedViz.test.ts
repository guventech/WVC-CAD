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
import { parseSketchJson } from "../serialization/SketchSerializer.ts";
import fixtureFreeRectangleJson from "../../tests/fixtures/free-rectangle-green-false-positive.sketch.json?raw";
import fixturePartialRectangleJson from "../../tests/fixtures/partial-rectangle-green-top-free.sketch.json?raw";
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
    expect(viz.fullyConstrainedEntityIds.has(created.line.id)).toBe(false);
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
    expect(viz.fullyConstrainedEntityIds.size).toBe(sketch.geometry.length);
    expect(viz.summary).toMatch(/fully constrained/i);
  });

  it("does not mark any edge green on a free floating rectangle", () => {
    const sketch = createAddRectangleCommand(
      { x: 54, y: 20 },
      { x: 214, y: 80 },
    )!.apply(createEmptySketch());
    const viz = analyzeUnderConstrainedVisualization(sketch);
    expect(viz.degreesOfFreedom).toBeGreaterThan(0);
    const lines = sketch.geometry.filter((entity) => entity.type === "line");
    expect(lines.length).toBe(4);
    for (const line of lines) {
      expect(viz.fullyConstrainedEntityIds.has(line.id)).toBe(false);
    }
  });

  it("regression: sketch-1 (8) free rectangle has no green edges", () => {
    const parsed = parseSketchJson(fixtureFreeRectangleJson);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    const viz = analyzeUnderConstrainedVisualization(parsed.sketch);
    expect(viz.degreesOfFreedom).toBeGreaterThan(0);
    const lines = parsed.sketch.geometry.filter((e) => e.type === "line");
    expect(lines.length).toBe(4);
    for (const line of lines) {
      expect(viz.fullyConstrainedEntityIds.has(line.id)).toBe(false);
    }
  });

  it("regression: sketch-1 (9) only top edge stays non-green when height is free", () => {
    const parsed = parseSketchJson(fixturePartialRectangleJson);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    const feature = parsed.sketch.constraints
      .map(parseRectangleFeature)
      .find((item) => item !== null)!;
    const viz = analyzeUnderConstrainedVisualization(parsed.sketch);
    expect(viz.degreesOfFreedom).toBeGreaterThan(0);
    expect(viz.fullyConstrainedEntityIds.has(feature.edges.bottom)).toBe(true);
    expect(viz.fullyConstrainedEntityIds.has(feature.edges.left)).toBe(true);
    expect(viz.fullyConstrainedEntityIds.has(feature.edges.right)).toBe(true);
    expect(viz.fullyConstrainedEntityIds.has(feature.edges.top)).toBe(false);
  });

  it("marks a fully fixed line green while a free point stays unconstrained", () => {
    const lineCreated = addLineToSketch(
      createEmptySketch(),
      { x: 0, y: 0 },
      { x: 40, y: 0 },
    )!;
    let sketch = addCoincidentToSketch(
      lineCreated.sketch,
      { entityId: lineCreated.line.id, role: "start" },
      { entityId: DATUM_ORIGIN_ID, role: "position" },
    )!;

    const horiz = prepareAddConstraint(sketch, {
      type: "horizontal",
      references: [{ entityId: lineCreated.line.id, role: "entity" }],
    });
    expect(horiz.ok).toBe(true);
    if (!horiz.ok) {
      return;
    }
    sketch = horiz.sketch;

    const length = prepareAddConstraint(sketch, {
      type: "length",
      references: [{ entityId: lineCreated.line.id, role: "entity" }],
    });
    expect(length.ok).toBe(true);
    if (!length.ok) {
      return;
    }
    sketch = length.sketch;

    const freePoint = addPointToSketch(sketch, { x: 80, y: 80 });
    const viz = analyzeUnderConstrainedVisualization(freePoint.sketch);
    expect(viz.degreesOfFreedom).toBeGreaterThan(0);
    expect(viz.fullyConstrainedEntityIds.has(lineCreated.line.id)).toBe(true);
    expect(viz.fullyConstrainedEntityIds.has(freePoint.point.id)).toBe(false);
  });

  it("formats summary without inventing DOF from handle counts alone", () => {
    expect(formatUnderConstrainedSummary(2, [])).toMatch(/2 DOF remain/);
  });
});
