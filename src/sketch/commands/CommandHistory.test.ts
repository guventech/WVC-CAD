import { describe, expect, it } from "vitest";
import {
  canRedo,
  canUndo,
  clearCommandHistory,
  createCommandHistory,
  executeCommand,
  peekRedoLabel,
  peekUndoLabel,
  redoCommand,
  undoCommand,
} from "./Command.ts";
import { createAddMaintainedConstraintCommand } from "./AddMaintainedConstraintCommand.ts";
import { createAddPointCommand } from "./CreateGeometryCommand.ts";
import { createAddLineCommand } from "./CreateGeometryCommand.ts";
import { createDeleteConstraintCommand } from "./DeleteConstraintCommand.ts";
import { createDeleteGeometryCommand } from "./DeleteGeometryCommand.ts";
import { createEditDimensionCommand } from "./EditDimensionCommand.ts";
import { createMovePointCommand } from "./MovePointCommand.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { createEmptySketch } from "../model/Sketch.ts";

describe("CommandHistory", () => {
  it("undoes and redoes add / move / delete point commands", () => {
    resetEntityIdCounter();
    let sketch = createEmptySketch();
    let history = createCommandHistory();

    const add = createAddPointCommand({ x: 10, y: 20 }, { id: "point-1" });
    ({ sketch, history } = executeCommand(history, sketch, add));
    expect(sketch.geometry).toHaveLength(1);

    const move = createMovePointCommand(
      "point-1",
      { x: 10, y: 20 },
      { x: 30, y: 40 },
    );
    expect(move).not.toBeNull();
    ({ sketch, history } = executeCommand(history, sketch, move!));
    expect(sketch.geometry[0]).toMatchObject({
      type: "point",
      position: { x: 30, y: 40 },
    });

    const del = createDeleteGeometryCommand(sketch, ["point-1"]);
    expect(del).not.toBeNull();
    ({ sketch, history } = executeCommand(history, sketch, del!));
    expect(sketch.geometry).toHaveLength(0);

    ({ sketch, history } = undoCommand(history, sketch));
    expect(sketch.geometry).toHaveLength(1);
    expect(sketch.geometry[0]).toMatchObject({
      position: { x: 30, y: 40 },
    });

    ({ sketch, history } = undoCommand(history, sketch));
    expect(sketch.geometry[0]).toMatchObject({
      position: { x: 10, y: 20 },
    });

    ({ sketch, history } = redoCommand(history, sketch));
    expect(sketch.geometry[0]).toMatchObject({
      position: { x: 30, y: 40 },
    });
  });

  it("clears the redo stack on a new execute after undo", () => {
    resetEntityIdCounter();
    let sketch = createEmptySketch();
    let history = createCommandHistory();

    ({ sketch, history } = executeCommand(
      history,
      sketch,
      createAddPointCommand({ x: 0, y: 0 }, { id: "a" }),
    ));
    ({ sketch, history } = executeCommand(
      history,
      sketch,
      createAddPointCommand({ x: 1, y: 1 }, { id: "b" }),
    ));
    ({ sketch, history } = undoCommand(history, sketch));
    expect(canRedo(history)).toBe(true);

    ({ sketch, history } = executeCommand(
      history,
      sketch,
      createAddPointCommand({ x: 2, y: 2 }, { id: "c" }),
    ));
    expect(canRedo(history)).toBe(false);
    expect(sketch.geometry.map((entity) => entity.id)).toEqual(["a", "c"]);
  });

  it("exposes undo/redo labels and clearCommandHistory", () => {
    resetEntityIdCounter();
    let sketch = createEmptySketch();
    let history = createCommandHistory();

    expect(peekUndoLabel(history)).toBeNull();
    expect(peekRedoLabel(history)).toBeNull();

    ({ sketch, history } = executeCommand(
      history,
      sketch,
      createAddPointCommand({ x: 5, y: 5 }, { id: "p" }),
    ));
    expect(canUndo(history)).toBe(true);
    expect(peekUndoLabel(history)).toContain("point");

    ({ sketch, history } = undoCommand(history, sketch));
    expect(peekRedoLabel(history)).toContain("point");

    history = clearCommandHistory();
    expect(canUndo(history)).toBe(false);
    expect(canRedo(history)).toBe(false);
    expect(sketch.geometry).toHaveLength(0);
  });

  it("deletes a constraint and restores it on undo", () => {
    resetEntityIdCounter();
    let sketch = createEmptySketch();
    let history = createCommandHistory();

    // Axis-aligned create already inserts H/V — use that as the delete target.
    const line = createAddLineCommand({ x: 0, y: 0 }, { x: 40, y: 0 })!;
    ({ sketch, history } = executeCommand(history, sketch, line));
    expect(sketch.constraints.some((c) => c.type === "horizontal")).toBe(true);

    const constraintId = sketch.constraints.find((c) => c.type === "horizontal")!
      .id;
    const del = createDeleteConstraintCommand(sketch, constraintId);
    expect(del).not.toBeNull();
    ({ sketch, history } = executeCommand(history, sketch, del!));
    expect(sketch.constraints.some((c) => c.id === constraintId)).toBe(false);

    ({ sketch, history } = undoCommand(history, sketch));
    expect(sketch.constraints.some((c) => c.id === constraintId)).toBe(true);

    ({ sketch, history } = redoCommand(history, sketch));
    expect(sketch.constraints.some((c) => c.id === constraintId)).toBe(false);
  });

  it("round-trips create → constrain → edit dimension via undo/redo", () => {
    resetEntityIdCounter();
    let sketch = createEmptySketch();
    let history = createCommandHistory();

    const line = createAddLineCommand({ x: 0, y: 0 }, { x: 50, y: 0 })!;
    ({ sketch, history } = executeCommand(history, sketch, line));
    const lineId = sketch.geometry[0]!.id;

    const lengthAdd = createAddMaintainedConstraintCommand(sketch, {
      type: "length",
      references: [{ entityId: lineId, role: "entity" }],
    });
    expect(lengthAdd.ok).toBe(true);
    if (!lengthAdd.ok) {
      return;
    }
    ({ sketch, history } = executeCommand(history, sketch, lengthAdd.command));
    const lengthId = sketch.constraints.find((c) => c.type === "length")!.id;
    expect(
      sketch.constraints.find((c) => c.id === lengthId)?.value,
    ).toBeCloseTo(50, 5);

    const edited = createEditDimensionCommand(sketch, lengthId, { value: 80 });
    expect(edited.ok).toBe(true);
    if (!edited.ok) {
      return;
    }
    ({ sketch, history } = executeCommand(history, sketch, edited.command));
    const afterEdit = sketch;
    expect(
      afterEdit.constraints.find((c) => c.id === lengthId)?.value,
    ).toBeCloseTo(80, 5);

    ({ sketch, history } = undoCommand(history, sketch));
    expect(sketch.constraints.find((c) => c.id === lengthId)?.value).toBeCloseTo(
      50,
      5,
    );

    ({ sketch, history } = redoCommand(history, sketch));
    expect(sketch.constraints.find((c) => c.id === lengthId)?.value).toBeCloseTo(
      80,
      5,
    );
    expect(sketch.geometry).toEqual(afterEdit.geometry);
    expect(sketch.constraints).toEqual(afterEdit.constraints);
  });
});
