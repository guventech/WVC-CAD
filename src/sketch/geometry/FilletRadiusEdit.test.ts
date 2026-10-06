import { describe, expect, it } from "vitest";
import { createEditDimensionCommand } from "../commands/EditDimensionCommand.ts";
import { listUnsatisfiedConstraints } from "../constraints/ConstraintMaintenance.ts";
import { parseSketchJson } from "../serialization/SketchSerializer.ts";
import fixtureJson from "../../tests/fixtures/fillet-chamfer-radius-edit.sketch.json?raw";

describe("fillet+chamfer radius edit", () => {
  it("changes both fillet radii without tearing chamfers or sibling fillets", () => {
    const parsed = parseSketchJson(fixtureJson);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    let sketch = parsed.sketch;

    for (const radiusId of ["constraint-249", "constraint-338"] as const) {
      for (const nextRadius of [25, 12, 20] as const) {
        const edited = createEditDimensionCommand(sketch, radiusId, {
          value: nextRadius,
        });
        expect(
          edited.ok,
          `${radiusId} -> ${nextRadius}: ${!edited.ok ? edited.reason : "ok"}`,
        ).toBe(true);
        if (!edited.ok) {
          return;
        }
        sketch = edited.command.apply(sketch);
        expect(listUnsatisfiedConstraints(sketch)).toEqual([]);
        const arcId = sketch.constraints.find((c) => c.id === radiusId)!
          .references[0]!.entityId;
        const arc = sketch.geometry.find((e) => e.id === arcId);
        expect(arc?.type).toBe("arc");
        if (arc?.type === "arc") {
          expect(arc.radius).toBeCloseTo(nextRadius, 2);
        }
      }
    }

    expect(sketch.geometry.some((e) => e.id === "line-254")).toBe(true);
    expect(sketch.geometry.some((e) => e.id === "line-262")).toBe(true);
    expect(
      sketch.constraints.filter((c) => c.type === "chamfer").map((c) => c.value),
    ).toEqual([20, 20]);
  });
});
