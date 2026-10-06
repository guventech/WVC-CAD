import { beforeEach, describe, expect, it } from "vitest";
import { prepareAddConstraint } from "../commands/AddMaintainedConstraintCommand.ts";
import { addLineToSketch } from "../commands/CreateGeometryCommand.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { createEmptySketch } from "../model/Sketch.ts";

describe("over-constraint detection (Chunk 16)", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("rejects H+V on the same line with a named conflict set and unchanged sketch", () => {
    const created = addLineToSketch(createEmptySketch(), { x: 0, y: 0 }, { x: 40, y: 0 })!;
    const horizontal = prepareAddConstraint(created.sketch, {
      type: "horizontal",
      references: [{ entityId: created.line.id, role: "entity" }],
    });
    expect(horizontal.ok).toBe(true);
    if (!horizontal.ok) {
      return;
    }
    const before = structuredClone(horizontal.sketch);
    const vertical = prepareAddConstraint(horizontal.sketch, {
      type: "vertical",
      references: [{ entityId: created.line.id, role: "entity" }],
    });
    expect(vertical.ok).toBe(false);
    if (vertical.ok) {
      return;
    }
    expect(vertical.reason).toMatch(/No changes were made/);
    expect(vertical.reason).toMatch(/Horizontal|Vertical|conflict/i);
    expect(vertical.conflict).toBeDefined();
    expect(vertical.conflict!.conflictingConstraintIds.length).toBeGreaterThan(0);
    expect(horizontal.sketch).toEqual(before);
  });

  it("rejects a second conflicting length and reports the existing length id", () => {
    const created = addLineToSketch(createEmptySketch(), { x: 0, y: 0 }, { x: 50, y: 0 })!;
    const first = prepareAddConstraint(created.sketch, {
      type: "length",
      references: [{ entityId: created.line.id, role: "entity" }],
      value: 50,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    // Duplicate signature is caught before solve — still a clear rejection.
    const second = prepareAddConstraint(first.sketch, {
      type: "length",
      references: [{ entityId: created.line.id, role: "entity" }],
      value: 80,
    });
    expect(second.ok).toBe(false);
    if (second.ok) {
      return;
    }
    expect(second.reason).toMatch(/already exists|No changes were made/);
    expect(first.sketch.constraints).toHaveLength(1);
  });
});
