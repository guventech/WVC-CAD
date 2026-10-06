import { beforeEach, describe, expect, it } from "vitest";
import {
  createCommandHistory,
  executeCommand,
  undoCommand,
} from "./Command.ts";
import { createAddRectangleCommand } from "./CreateRectangleCommand.ts";
import { createDeleteGeometryCommand } from "./DeleteGeometryCommand.ts";
import {
  movePointInSketch,
  moveRectangleEdgeInSketch,
} from "./MovePointCommand.ts";
import { isAxisAlignedRectangle } from "../geometry/RectangleMath.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import {
  parseRectangleFeature,
  readRectangleCorners,
} from "../model/RectangleFeature.ts";
import { createEmptySketch } from "../model/Sketch.ts";

describe("rectangle commands", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("creates four corner points, four edges, and rectangle constraints", () => {
    const command = createAddRectangleCommand(
      { x: 0, y: 0 },
      { x: 40, y: 20 },
    );
    expect(command).not.toBeNull();

    const result = executeCommand(
      createCommandHistory(),
      createEmptySketch(),
      command!,
    );

    expect(result.sketch.geometry).toHaveLength(8);
    expect(
      result.sketch.geometry.filter((entity) => entity.type === "point"),
    ).toHaveLength(4);
    expect(
      result.sketch.geometry.filter((entity) => entity.type === "line"),
    ).toHaveLength(4);

    const rectangle = result.sketch.constraints.find(
      (constraint) => constraint.type === "rectangle",
    );
    expect(rectangle).toBeDefined();
    expect(
      result.sketch.constraints.filter((c) => c.type === "horizontal"),
    ).toHaveLength(2);
    expect(
      result.sketch.constraints.filter((c) => c.type === "vertical"),
    ).toHaveLength(2);
    expect(
      result.sketch.constraints.filter((c) => c.type === "coincident"),
    ).toHaveLength(4);
  });

  it("rejects zero-area rectangles", () => {
    expect(
      createAddRectangleCommand({ x: 0, y: 0 }, { x: 0, y: 10 }),
    ).toBeNull();
  });

  it("keeps the rectangle coherent when dragging a corner point", () => {
    const created = executeCommand(
      createCommandHistory(),
      createEmptySketch(),
      createAddRectangleCommand({ x: 0, y: 0 }, { x: 100, y: 50 })!,
    );

    const feature = parseRectangleFeature(
      created.sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;
    const moved = movePointInSketch(created.sketch, feature.corners.tr!, {
      x: 70,
      y: 40,
    });

    const corners = readRectangleCorners(moved.geometry, feature)!;
    expect(isAxisAlignedRectangle(corners)).toBe(true);
    expect(corners).toEqual({
      bl: { x: 0, y: 0 },
      br: { x: 70, y: 0 },
      tr: { x: 70, y: 40 },
      tl: { x: 0, y: 40 },
    });

    const bottom = moved.geometry.find(
      (entity) => entity.id === feature.edges.bottom,
    );
    expect(bottom?.type).toBe("line");
    if (bottom?.type === "line") {
      expect(bottom.start).toEqual(corners.bl);
      expect(bottom.end).toEqual(corners.br);
    }
  });

  it("keeps the rectangle coherent when dragging an edge", () => {
    const created = executeCommand(
      createCommandHistory(),
      createEmptySketch(),
      createAddRectangleCommand({ x: 0, y: 0 }, { x: 100, y: 50 })!,
    );
    const feature = parseRectangleFeature(
      created.sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;

    const moved = moveRectangleEdgeInSketch(
      created.sketch,
      feature.edges.right,
      { x: 130, y: 25 },
    );
    const corners = readRectangleCorners(moved.geometry, feature)!;
    expect(isAxisAlignedRectangle(corners)).toBe(true);
    expect(corners).toEqual({
      bl: { x: 0, y: 0 },
      br: { x: 130, y: 0 },
      tr: { x: 130, y: 50 },
      tl: { x: 0, y: 50 },
    });

    const collapsed = moveRectangleEdgeInSketch(
      created.sketch,
      feature.edges.right,
      { x: 0, y: 0 },
    );
    expect(collapsed).toBe(created.sketch);
  });

  it("deletes the whole rectangle feature from one selected edge", () => {
    let history = createCommandHistory();
    let sketch = createEmptySketch();
    const created = executeCommand(
      history,
      sketch,
      createAddRectangleCommand({ x: 0, y: 0 }, { x: 30, y: 20 })!,
    );
    sketch = created.sketch;
    history = created.history;

    const feature = parseRectangleFeature(
      sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;
    const deleted = executeCommand(
      history,
      sketch,
      createDeleteGeometryCommand(sketch, [feature.edges.top])!,
    );

    expect(deleted.sketch.geometry).toHaveLength(0);
    expect(deleted.sketch.constraints).toHaveLength(0);

    const undone = undoCommand(deleted.history, deleted.sketch);
    expect(undone.sketch.geometry).toHaveLength(8);
    expect(undone.sketch.constraints.length).toBeGreaterThan(0);
  });
});
