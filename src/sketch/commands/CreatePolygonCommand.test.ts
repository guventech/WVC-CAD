import { describe, expect, it } from "vitest";
import { createCommandHistory, executeCommand } from "./Command.ts";
import { createAddPolygonCommand } from "./CreatePolygonCommand.ts";
import { createEmptySketch } from "../model/Sketch.ts";

describe("CreatePolygonCommand", () => {
  it("adds a hexagon with equal-side constraints", () => {
    const command = createAddPolygonCommand({ x: 0, y: 0 }, { x: 20, y: 0 })!;
    const result = executeCommand(createCommandHistory(), createEmptySketch(), command);
    const lines = result.sketch.geometry.filter((g) => g.type === "line");
    expect(lines).toHaveLength(6);
    const equals = result.sketch.constraints.filter((c) => c.type === "equal");
    expect(equals.length).toBeGreaterThanOrEqual(5);
  });

  it("honors an explicit side count", () => {
    const command = createAddPolygonCommand({ x: 0, y: 0 }, { x: 20, y: 0 }, {
      sides: 4,
    })!;
    const result = executeCommand(createCommandHistory(), createEmptySketch(), command);
    const lines = result.sketch.geometry.filter((g) => g.type === "line");
    expect(lines).toHaveLength(4);
    expect(command.label).toContain("4");
  });
});
