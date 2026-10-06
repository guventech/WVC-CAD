import { describe, expect, it } from "vitest";
import { createEditDimensionCommand } from "../commands/EditDimensionCommand.ts";
import { listUnsatisfiedConstraints } from "../constraints/ConstraintMaintenance.ts";
import { distance } from "./GeometryMath.ts";
import { parseSketchJson } from "../serialization/SketchSerializer.ts";
import fixtureJson from "../../tests/fixtures/length-on-filleted-edges.sketch.json?raw";

describe("length-on-filleted-edges radius edit", () => {
  it("edits TR fillet radius while keeping Length 100 on top+right", () => {
    const parsed = parseSketchJson(fixtureJson);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    let sketch = parsed.sketch;
    const radiusId = "constraint-767";
    const lengthValuesBefore = sketch.constraints
      .filter((c) => c.type === "length")
      .map((c) => c.value);

    for (const nextRadius of [15, 10, 20, 25] as const) {
      const edited = createEditDimensionCommand(sketch, radiusId, {
        value: nextRadius,
      });
      expect(
        edited.ok,
        `R=${nextRadius}: ${!edited.ok ? edited.reason : "ok"}`,
      ).toBe(true);
      if (!edited.ok) {
        return;
      }
      sketch = edited.command.apply(sketch);
      expect(listUnsatisfiedConstraints(sketch)).toEqual([]);
      const arc = sketch.geometry.find((e) => e.id === "arc-765");
      expect(arc?.type).toBe("arc");
      if (arc?.type !== "arc") {
        return;
      }
      expect(arc.radius).toBeCloseTo(nextRadius, 2);
      expect(
        sketch.constraints.filter((c) => c.type === "length").map((c) => c.value),
      ).toEqual(lengthValuesBefore);
      for (const length of sketch.constraints.filter((c) => c.type === "length")) {
        const line = sketch.geometry.find(
          (e) => e.id === length.references[0]?.entityId,
        );
        expect(line?.type).toBe("line");
        if (line?.type !== "line" || length.value === undefined) {
          return;
        }
        expect(distance(line.start, line.end)).toBeCloseTo(length.value, 1);
      }
    }
  });
});
