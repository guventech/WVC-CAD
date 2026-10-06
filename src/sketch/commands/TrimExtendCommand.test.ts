import { beforeEach, describe, expect, it } from "vitest";
import {
  createCommandHistory,
  executeCommand,
  undoCommand,
} from "../../sketch/commands/Command.ts";
import {
  addLineToSketch,
  createAddLineCommand,
} from "../../sketch/commands/CreateGeometryCommand.ts";
import {
  createTrimCommand,
} from "../../sketch/commands/TrimExtendCommand.ts";
import {
  applyExtendLine,
  applyTrimLine,
} from "../../sketch/geometry/TrimExtendOps.ts";
import { resetEntityIdCounter } from "../../sketch/model/EntityId.ts";
import { createEmptySketch } from "../../sketch/model/Sketch.ts";
import { createAddRectangleCommand } from "../../sketch/commands/CreateRectangleCommand.ts";

describe("Trim / Extend", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("trims a dangling end of a crossed line (keep-id)", () => {
    let sketch = createEmptySketch();
    sketch = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 100, y: 0 })!.sketch;
    sketch = addLineToSketch(sketch, { x: 40, y: -20 }, { x: 40, y: 20 })!.sketch;
    const targetId = sketch.geometry[0]!.id;

    const outcome = applyTrimLine(sketch, targetId, { x: 10, y: 0 });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }
    const line = outcome.sketch.geometry.find((e) => e.id === targetId);
    expect(line?.type).toBe("line");
    if (line?.type !== "line") {
      return;
    }
    expect(line.start.x).toBeCloseTo(40);
    expect(line.end.x).toBeCloseTo(100);
    expect(outcome.sketch.geometry).toHaveLength(2);
  });

  it("splits a line when trimming the middle interval", () => {
    let sketch = createEmptySketch();
    sketch = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 100, y: 0 })!.sketch;
    sketch = addLineToSketch(sketch, { x: 30, y: -10 }, { x: 30, y: 10 })!.sketch;
    sketch = addLineToSketch(sketch, { x: 70, y: -10 }, { x: 70, y: 10 })!.sketch;
    const targetId = sketch.geometry[0]!.id;

    const outcome = applyTrimLine(sketch, targetId, { x: 50, y: 0 });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }
    expect(outcome.sketch.geometry.find((e) => e.id === targetId)).toBeUndefined();
    const lines = outcome.sketch.geometry.filter((e) => e.type === "line");
    expect(lines).toHaveLength(4); // 2 cutters + 2 remnants
    const remnants = lines.filter(
      (e) => e.id !== sketch.geometry[1]!.id && e.id !== sketch.geometry[2]!.id,
    );
    expect(remnants).toHaveLength(2);
  });

  it("extends a line to a crossing cutter", () => {
    let sketch = createEmptySketch();
    sketch = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 40, y: 0 })!.sketch;
    sketch = addLineToSketch(sketch, { x: 80, y: -20 }, { x: 80, y: 20 })!.sketch;
    const targetId = sketch.geometry[0]!.id;

    const outcome = applyExtendLine(sketch, targetId, { x: 35, y: 0 });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }
    const line = outcome.sketch.geometry.find((e) => e.id === targetId);
    expect(line?.type).toBe("line");
    if (line?.type !== "line") {
      return;
    }
    expect(line.start).toEqual({ x: 0, y: 0 });
    expect(line.end.x).toBeCloseTo(80);
  });

  it("extends a line to a world axis", () => {
    let sketch = createEmptySketch();
    sketch = addLineToSketch(sketch, { x: 10, y: 20 }, { x: 50, y: 20 })!.sketch;
    const targetId = sketch.geometry[0]!.id;

    const outcome = applyExtendLine(sketch, targetId, { x: 12, y: 20 });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }
    const line = outcome.sketch.geometry.find((e) => e.id === targetId);
    expect(line?.type).toBe("line");
    if (line?.type !== "line") {
      return;
    }
    expect(line.start.x).toBeCloseTo(0);
    expect(line.start.y).toBeCloseTo(20);
  });

  it("rejects trim with no cutting boundary", () => {
    let sketch = createEmptySketch();
    sketch = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 50, y: 0 })!.sketch;
    const outcome = applyTrimLine(sketch, sketch.geometry[0]!.id, { x: 25, y: 0 });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) {
      return;
    }
    expect(outcome.reason).toBe("No cutting boundary");
  });

  it("blocks trimming rectangle feature edges", () => {
    let sketch = createEmptySketch();
    const command = createAddRectangleCommand(
      { x: 0, y: 0 },
      { x: 40, y: 20 },
    )!;
    sketch = command.apply(sketch);
    const edge = sketch.geometry.find((e) => e.type === "line")!;
    const outcome = applyTrimLine(sketch, edge.id, {
      x: (edge.type === "line" ? (edge.start.x + edge.end.x) / 2 : 0),
      y: (edge.type === "line" ? (edge.start.y + edge.end.y) / 2 : 0),
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) {
      return;
    }
    expect(outcome.reason).toContain("Rectangle");
  });

  it("undo restores geometry after trim command", () => {
    let sketch = createEmptySketch();
    const addA = createAddLineCommand({ x: 0, y: 0 }, { x: 100, y: 0 })!;
    const addB = createAddLineCommand({ x: 40, y: -20 }, { x: 40, y: 20 })!;
    let history = createCommandHistory();
    let result = executeCommand(history, sketch, addA);
    sketch = result.sketch;
    history = result.history;
    result = executeCommand(history, sketch, addB);
    sketch = result.sketch;
    history = result.history;

    const targetId = sketch.geometry[0]!.id;
    const before = sketch;
    const trim = createTrimCommand(sketch, targetId, { x: 10, y: 0 });
    expect(trim.ok).toBe(true);
    if (!trim.ok) {
      return;
    }
    result = executeCommand(history, sketch, trim.command);
    sketch = result.sketch;
    history = result.history;

    const trimmed = sketch.geometry.find((e) => e.id === targetId);
    expect(trimmed?.type).toBe("line");
    if (trimmed?.type === "line") {
      expect(trimmed.start.x).toBeCloseTo(40);
    }

    const undone = undoCommand(history, sketch);
    expect(undone.sketch.geometry).toEqual(before.geometry);
  });
});
