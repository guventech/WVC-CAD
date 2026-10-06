import { beforeEach, describe, expect, it } from "vitest";
import {
  addLineToSketch,
  createAddLineCommand,
  createLineGeometry,
} from "./CreateGeometryCommand.ts";
import {
  createCommandHistory,
  executeCommand,
  undoCommand,
} from "./Command.ts";
import { createMoveGeometryCommand } from "./GeometryEdit.ts";
import { applyGeometryDrag } from "./MovePointCommand.ts";
import {
  moveLineBodyInSketch,
  moveLineEndpointInSketch,
} from "./MovePointCommand.ts";
import { distance } from "../geometry/GeometryMath.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { createEmptySketch } from "../model/Sketch.ts";

describe("line geometry commands", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("creates a line at exact world coordinates", () => {
    const sketch = createEmptySketch();
    const result = addLineToSketch(
      sketch,
      { x: 0, y: 0 },
      { x: 40, y: 30 },
    );

    expect(result).not.toBeNull();
    expect(result!.line.start).toEqual({ x: 0, y: 0 });
    expect(result!.line.end).toEqual({ x: 40, y: 30 });
    expect(result!.sketch.geometry).toHaveLength(1);
    expect(sketch.geometry).toHaveLength(0);
  });

  it("adds a horizontal constraint for a perfect horizontal line", () => {
    const command = createAddLineCommand({ x: 0, y: 10 }, { x: 40, y: 10 });
    expect(command).not.toBeNull();
    let history = createCommandHistory();
    const result = executeCommand(history, createEmptySketch(), command!);
    expect(result.sketch.constraints).toHaveLength(1);
    expect(result.sketch.constraints[0]!.type).toBe("horizontal");
  });

  it("adds a vertical constraint for a perfect vertical line", () => {
    const command = createAddLineCommand({ x: 5, y: 0 }, { x: 5, y: 30 });
    expect(command).not.toBeNull();
    const result = executeCommand(
      createCommandHistory(),
      createEmptySketch(),
      command!,
    );
    expect(result.sketch.constraints[0]!.type).toBe("vertical");
  });

  it("does not add orientation for a diagonal line", () => {
    const command = createAddLineCommand({ x: 0, y: 0 }, { x: 40, y: 30 });
    expect(command).not.toBeNull();
    const result = executeCommand(
      createCommandHistory(),
      createEmptySketch(),
      command!,
    );
    expect(result.sketch.constraints).toHaveLength(0);
  });

  it("rejects zero-length lines", () => {
    expect(
      createLineGeometry({ x: 5, y: 5 }, { x: 5, y: 5 }),
    ).toBeNull();
    expect(
      addLineToSketch(createEmptySketch(), { x: 1, y: 1 }, { x: 1, y: 1 }),
    ).toBeNull();
    expect(
      createAddLineCommand({ x: 2, y: 3 }, { x: 2, y: 3 }),
    ).toBeNull();
  });

  it("undo removes a created line", () => {
    let sketch = createEmptySketch();
    let history = createCommandHistory();
    const command = createAddLineCommand({ x: 0, y: 0 }, { x: 10, y: 0 });
    expect(command).not.toBeNull();

    const applied = executeCommand(history, sketch, command!);
    sketch = applied.sketch;
    history = applied.history;
    expect(sketch.geometry).toHaveLength(1);

    const undone = undoCommand(history, sketch);
    expect(undone.sketch.geometry).toHaveLength(0);
  });

  it("adds midpoint constraints when create snaps to midpoints", () => {
    const base = addLineToSketch(
      createEmptySketch(),
      { x: 0, y: 0 },
      { x: 40, y: 0 },
    )!;
    // New line from base midpoint (20,0) to (20,30).
    const command = createAddLineCommand(
      { x: 20, y: 0 },
      { x: 20, y: 30 },
      { startMidpointOf: base.line.id },
    )!;
    const result = executeCommand(
      createCommandHistory(),
      base.sketch,
      command,
    );
    const midpoints = result.sketch.constraints.filter((c) => c.type === "midpoint");
    expect(midpoints).toHaveLength(1);
    expect(midpoints[0]!.references[1]!.entityId).toBe(base.line.id);

    const undone = undoCommand(result.history, result.sketch);
    expect(
      undone.sketch.constraints.filter((c) => c.type === "midpoint"),
    ).toHaveLength(0);
    expect(undone.sketch.geometry).toHaveLength(1);
  });

  it("moves a line endpoint and rejects zero length", () => {
    const created = addLineToSketch(
      createEmptySketch(),
      { x: 0, y: 0 },
      { x: 40, y: 0 },
    )!;

    const moved = moveLineEndpointInSketch(
      created.sketch,
      created.line.id,
      "end",
      { x: 40, y: 30 },
    );
    const line = moved.geometry.find((entity) => entity.id === created.line.id);
    expect(line?.type).toBe("line");
    if (line?.type === "line") {
      expect(line.start).toEqual({ x: 0, y: 0 });
      expect(line.end).toEqual({ x: 40, y: 30 });
    }

    const rejected = moveLineEndpointInSketch(
      created.sketch,
      created.line.id,
      "end",
      { x: 0, y: 0 },
    );
    expect(rejected).toBe(created.sketch);
  });

  it("translates a line body without changing length or angle", () => {
    const created = addLineToSketch(
      createEmptySketch(),
      { x: 0, y: 0 },
      { x: 40, y: 30 },
    )!;
    const grabOffset = { x: 20, y: 15 };
    const span = { x: 40, y: 30 };
    const moved = moveLineBodyInSketch(
      created.sketch,
      created.line.id,
      grabOffset,
      span,
      { x: 50, y: 45 },
    );

    const line = moved.geometry.find((entity) => entity.id === created.line.id);
    expect(line?.type).toBe("line");
    if (line?.type === "line") {
      expect(line.start).toEqual({ x: 30, y: 30 });
      expect(line.end).toEqual({ x: 70, y: 60 });
      expect(distance(line.start, line.end)).toBeCloseTo(
        distance(created.line.start, created.line.end),
      );
    }
  });

  it("undoes a line-body move command", () => {
    const created = addLineToSketch(
      createEmptySketch(),
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    )!;
    const target = {
      kind: "line-body" as const,
      entityId: created.line.id,
      grabOffset: { x: 5, y: 0 },
      span: { x: 10, y: 0 },
    };
    const command = createMoveGeometryCommand(
      created.sketch,
      target,
      { x: 5, y: 0 },
      { x: 15, y: 10 },
    )!;

    const applied = executeCommand(
      createCommandHistory(),
      created.sketch,
      command,
    );
    const movedLine = applied.sketch.geometry.find(
      (entity) => entity.id === created.line.id,
    );
    expect(movedLine?.type).toBe("line");
    if (movedLine?.type === "line") {
      expect(movedLine.start).toEqual({ x: 10, y: 10 });
      expect(movedLine.end).toEqual({ x: 20, y: 10 });
    }

    const undone = undoCommand(applied.history, applied.sketch);
    const restored = undone.sketch.geometry.find(
      (entity) => entity.id === created.line.id,
    );
    expect(restored?.type).toBe("line");
    if (restored?.type === "line") {
      expect(restored.start).toEqual({ x: 0, y: 0 });
      expect(restored.end).toEqual({ x: 10, y: 0 });
    }

    // Preview path uses the same apply helper.
    const preview = applyGeometryDrag(created.sketch, target, { x: 15, y: 10 });
    expect(preview.geometry).toEqual(applied.sketch.geometry);
  });
});
