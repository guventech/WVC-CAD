import { beforeEach, describe, expect, it } from "vitest";
import {
  createCommandHistory,
  executeCommand,
} from "../commands/Command.ts";
import { createAddRectangleCommand } from "../commands/CreateRectangleCommand.ts";
import { addLineToSketch } from "../commands/CreateGeometryCommand.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { parseRectangleFeature } from "../model/RectangleFeature.ts";
import { createEmptySketch } from "../model/Sketch.ts";
import {
  countLogicalSelection,
  formatSelectionSummaryItem,
  summarizeSelection,
} from "./SelectionSummary.ts";

describe("SelectionSummary", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("summarizes a rectangle edge selection as rectangle W×H", () => {
    const created = executeCommand(
      createCommandHistory(),
      createEmptySketch(),
      createAddRectangleCommand({ x: 0, y: 0 }, { x: 100, y: 50 })!,
    );
    const feature = parseRectangleFeature(
      created.sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;

    const items = summarizeSelection(
      created.sketch.geometry,
      created.sketch.constraints,
      [feature.edges.right],
    );

    expect(items).toHaveLength(1);
    expect(items[0]?.kind).toBe("rectangle");
    if (items[0]?.kind === "rectangle") {
      expect(items[0].widthMm).toBe(100);
      expect(items[0].heightMm).toBe(50);
    }
    expect(formatSelectionSummaryItem(items[0]!)).toContain("Rectangle");
    expect(formatSelectionSummaryItem(items[0]!)).toContain("100.00");
    expect(formatSelectionSummaryItem(items[0]!)).toContain("50.00");
    expect(countLogicalSelection(created.sketch.constraints, [
      feature.edges.right,
      feature.corners.tr!,
    ])).toBe(1);
  });

  it("keeps free lines as line summaries", () => {
    const created = addLineToSketch(
      createEmptySketch(),
      { x: 0, y: 0 },
      { x: 30, y: 0 },
    )!;
    const items = summarizeSelection(
      created.sketch.geometry,
      created.sketch.constraints,
      [created.line.id],
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.kind).toBe("entity");
    expect(formatSelectionSummaryItem(items[0]!)).toContain("Line");
  });
});
