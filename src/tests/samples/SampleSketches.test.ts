import { describe, expect, it } from "vitest";
import { createEditDimensionCommand } from "../../sketch/commands/EditDimensionCommand.ts";
import { settleLoadedSketch } from "../../sketch/constraints/ConstraintMaintenance.ts";
import { isDimensionalConstraintType } from "../../sketch/model/Constraint.ts";
import { analyzeProfiles } from "../../sketch/analysis/ProfileAnalyzer.ts";
import { parseSketchJson } from "../../sketch/serialization/SketchSerializer.ts";
import { solve } from "../../sketch/solver/Solver.ts";
import type { Sketch } from "../../sketch/model/Sketch.ts";

import anchoredRaw from "../../../public/samples/fully-constrained-rectangle.sketch.json?raw";
import plateRaw from "../../../public/samples/filleted-plate-with-hole.sketch.json?raw";
import bracketRaw from "../../../public/samples/mirrored-bracket.sketch.json?raw";
import slotRaw from "../../../public/samples/capsule-slot.sketch.json?raw";
import overRaw from "../../../public/samples/over-constrained-line.sketch.json?raw";

function loadSample(raw: string): Sketch {
  const parsed = parseSketchJson(raw);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) {
    throw new Error(parsed.reason);
  }
  return settleLoadedSketch(parsed.sketch);
}

function firstDrivingDimension(sketch: Sketch, type?: string) {
  return sketch.constraints.find(
    (c) =>
      isDimensionalConstraintType(c.type) &&
      c.driving !== false &&
      typeof c.value === "number" &&
      (type === undefined || c.type === type),
  );
}

describe("public sample sketches", () => {
  it("anchored rectangle is fully constrained and survives length edit", () => {
    let sketch = loadSample(anchoredRaw);
    let result = solve(sketch);
    expect(result.status).toBe("solved");
    expect(result.degreesOfFreedom).toBe(0);

    const length = firstDrivingDimension(sketch, "length");
    expect(length).toBeDefined();
    const edited = createEditDimensionCommand(sketch, length!.id, {
      value: (length!.value ?? 100) + 10,
    });
    expect(edited.ok).toBe(true);
    if (!edited.ok) {
      return;
    }
    sketch = edited.command.apply(sketch);
    result = solve(sketch);
    expect(result.status === "solved" || result.status === "under-constrained").toBe(
      true,
    );
    expect(result.status).not.toBe("inconsistent");
    expect(analyzeProfiles(sketch).outerLoopCount).toBeGreaterThanOrEqual(1);
  });

  it("filleted plate is fully constrained and survives radius edit", () => {
    let sketch = loadSample(plateRaw);
    let result = solve(sketch);
    expect(result.status).toBe("solved");
    expect(result.degreesOfFreedom).toBe(0);

    const radius = firstDrivingDimension(sketch, "radius");
    expect(radius).toBeDefined();
    const edited = createEditDimensionCommand(sketch, radius!.id, {
      value: Math.max(5, (radius!.value ?? 15) + 2),
    });
    expect(edited.ok).toBe(true);
    if (!edited.ok) {
      return;
    }
    sketch = edited.command.apply(sketch);
    result = solve(sketch);
    expect(result.status === "solved" || result.status === "under-constrained").toBe(
      true,
    );
    expect(result.status).not.toBe("inconsistent");
    expect(sketch.geometry.some((g) => g.type === "arc")).toBe(true);
    expect(sketch.geometry.some((g) => g.type === "circle")).toBe(true);
  });

  it("L-bracket sample is fully constrained and survives length edit", () => {
    let sketch = loadSample(bracketRaw);
    let result = solve(sketch);
    expect(result.status).toBe("solved");
    expect(result.degreesOfFreedom).toBe(0);

    const length = firstDrivingDimension(sketch, "length");
    expect(length).toBeDefined();
    const edited = createEditDimensionCommand(sketch, length!.id, {
      value: (length!.value ?? 60) + 5,
    });
    expect(edited.ok).toBe(true);
    if (!edited.ok) {
      return;
    }
    sketch = edited.command.apply(sketch);
    result = solve(sketch);
    expect(result.status).toBe("solved");
  });

  it("capsule slot loads without inconsistency", () => {
    const sketch = loadSample(slotRaw);
    const result = solve(sketch);
    expect(result.status).not.toBe("inconsistent");
    expect(result.status).not.toBe("failed");
  });

  it("over-constrained line remains an inconsistent demo", () => {
    const sketch = loadSample(overRaw);
    const result = solve(sketch);
    // Conflicting lengths 50 vs 75 — may surface as over-constrained, inconsistent, or failed.
    expect(["inconsistent", "over-constrained", "failed"]).toContain(result.status);
  });
});
