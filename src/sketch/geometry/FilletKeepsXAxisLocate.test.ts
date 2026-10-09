import { beforeEach, describe, expect, it } from "vitest";
import { createAddMaintainedConstraintCommand } from "../commands/AddMaintainedConstraintCommand.ts";
import { createAddRectangleCommand } from "../commands/CreateRectangleCommand.ts";
import {
  listUnsatisfiedConstraints,
  settleLoadedSketch,
} from "../constraints/ConstraintMaintenance.ts";
import { applyFilletLines } from "./FilletChamferOps.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { parseRectangleFeature } from "../model/RectangleFeature.ts";
import {
  DATUM_AXIS_X_ID,
  DATUM_AXIS_Y_ID,
} from "../model/SketchFrame.ts";
import { createEmptySketch, type Sketch } from "../model/Sketch.ts";
import { parseSketchJson } from "../serialization/SketchSerializer.ts";
import fixtureJson from "../../tests/fixtures/fillet-broke-x-axis-locate.sketch.json?raw";

function lineOf(sketch: Sketch, id: string) {
  const entity = sketch.geometry.find((e) => e.id === id);
  expect(entity?.type).toBe("line");
  if (entity?.type !== "line") {
    throw new Error("expected line");
  }
  return entity;
}

/**
 * sketch-12: locate via SmartDistance (coordinate-x / coordinate-y), size with
 * edge lengths, fillet all four corners. Bottom must stay on X (y=0); left on Y.
 */
describe("fillet keeps X-axis locate (sketch-12)", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("coordinate locate + lengths + four fillets keep bottom on X", () => {
    let sketch = createAddRectangleCommand(
      { x: 0, y: 0 },
      { x: 160.5, y: 140 },
    )!.apply(createEmptySketch());
    const rect = parseRectangleFeature(
      sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;

    for (const spec of [
      {
        type: "coordinate-x" as const,
        edge: rect.edges.left,
        value: 0,
        role: "start" as const,
      },
      {
        type: "coordinate-y" as const,
        edge: rect.edges.bottom,
        value: 0,
        role: "start" as const,
      },
      {
        type: "length" as const,
        edge: rect.edges.top,
        value: 160.5,
        role: "entity" as const,
      },
      {
        type: "length" as const,
        edge: rect.edges.right,
        value: 140,
        role: "entity" as const,
      },
    ]) {
      const outcome = createAddMaintainedConstraintCommand(sketch, {
        type: spec.type,
        references: [{ entityId: spec.edge, role: spec.role }],
        value: spec.value,
      });
      expect(outcome.ok, outcome.ok ? "" : outcome.reason).toBe(true);
      if (!outcome.ok) {
        return;
      }
      sketch = outcome.command.apply(sketch);
    }

    const corners = [
      {
        a: rect.edges.left,
        b: rect.edges.top,
        pick: { x: 20, y: 120 },
        r: 40,
      },
      {
        a: rect.edges.top,
        b: rect.edges.right,
        pick: { x: 140, y: 120 },
        r: 40,
      },
      {
        a: rect.edges.left,
        b: rect.edges.bottom,
        pick: { x: 20, y: 20 },
        r: 32,
      },
      {
        a: rect.edges.bottom,
        b: rect.edges.right,
        pick: { x: 140, y: 20 },
        r: 54,
      },
    ] as const;

    for (const corner of corners) {
      const fillet = applyFilletLines(
        sketch,
        corner.a,
        corner.b,
        corner.pick,
        corner.r,
      );
      expect(fillet.ok, fillet.ok ? "" : fillet.reason).toBe(true);
      if (!fillet.ok) {
        return;
      }
      sketch = fillet.sketch;
    }

    expect(listUnsatisfiedConstraints(sketch)).toEqual([]);
    expect(
      sketch.constraints.some(
        (c) =>
          c.type === "coordinate-y" &&
          c.references[0]?.entityId === rect.edges.bottom,
      ),
    ).toBe(true);
    expect(
      sketch.constraints.some(
        (c) =>
          c.type === "coordinate-x" &&
          c.references[0]?.entityId === rect.edges.left,
      ),
    ).toBe(true);

    const left = lineOf(sketch, rect.edges.left);
    const bottom = lineOf(sketch, rect.edges.bottom);
    expect(Math.abs(left.start.x)).toBeLessThan(1e-3);
    expect(Math.abs(left.end.x)).toBeLessThan(1e-3);
    expect(Math.abs(bottom.start.y)).toBeLessThan(1e-3);
    expect(Math.abs(bottom.end.y)).toBeLessThan(1e-3);

    // Outer size kept via promoted spans (not expanded by segment lengths).
    const right = lineOf(sketch, rect.edges.right);
    expect(Math.abs(right.start.x - left.start.x)).toBeCloseTo(160.5, 2);
  });

  it("datum-snap create + lengths + four fillets keep bottom on X", () => {
    let sketch = createAddRectangleCommand(
      { x: 0, y: 140 },
      { x: 160.5, y: 0 },
      {
        cornerASnap: {
          type: "axis",
          point: { x: 0, y: 140 },
          sourceEntityId: DATUM_AXIS_Y_ID,
          priority: 1,
          label: "Y",
        },
        cornerBSnap: {
          type: "axis",
          point: { x: 160.5, y: 0 },
          sourceEntityId: DATUM_AXIS_X_ID,
          priority: 1,
          label: "X",
        },
      },
    )!.apply(createEmptySketch());
    const rect = parseRectangleFeature(
      sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;

    for (const [edge, value] of [
      [rect.edges.top, 160.5],
      [rect.edges.right, 140],
    ] as const) {
      const outcome = createAddMaintainedConstraintCommand(sketch, {
        type: "length",
        references: [{ entityId: edge, role: "entity" }],
        value,
      });
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) {
        return;
      }
      sketch = outcome.command.apply(sketch);
    }

    for (const corner of [
      { a: rect.edges.left, b: rect.edges.top, pick: { x: 20, y: 120 }, r: 40 },
      { a: rect.edges.top, b: rect.edges.right, pick: { x: 140, y: 120 }, r: 40 },
      { a: rect.edges.left, b: rect.edges.bottom, pick: { x: 20, y: 20 }, r: 32 },
      { a: rect.edges.bottom, b: rect.edges.right, pick: { x: 140, y: 20 }, r: 54 },
    ] as const) {
      const fillet = applyFilletLines(
        sketch,
        corner.a,
        corner.b,
        corner.pick,
        corner.r,
      );
      expect(fillet.ok, fillet.ok ? "" : fillet.reason).toBe(true);
      if (!fillet.ok) {
        return;
      }
      sketch = fillet.sketch;
    }

    expect(listUnsatisfiedConstraints(sketch)).toEqual([]);
    const left = lineOf(sketch, rect.edges.left);
    const bottom = lineOf(sketch, rect.edges.bottom);
    expect(Math.abs(left.start.x)).toBeLessThan(1e-3);
    expect(Math.abs(bottom.start.y)).toBeLessThan(1e-3);
  });

  it("documentary: sketch-12 fixture missing coordinate-y is not invented on load", () => {
    const parsed = parseSketchJson(fixtureJson);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    const rect = parseRectangleFeature(
      parsed.sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;
    const bottom = lineOf(parsed.sketch, rect.edges.bottom);
    expect(Math.abs(bottom.start.y)).toBeGreaterThan(1);
    expect(
      parsed.sketch.constraints.some((c) => c.type === "coordinate-y"),
    ).toBe(false);

    const settled = settleLoadedSketch(parsed.sketch);
    // Promote lengths only — do not invent the missing X-axis locate.
    expect(
      settled.constraints.some((c) => c.type === "coordinate-y"),
    ).toBe(false);
    expect(
      settled.constraints.some((c) => c.type === "horizontal-distance"),
    ).toBe(true);
  });
});
