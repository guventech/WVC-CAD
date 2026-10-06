import { beforeEach, describe, expect, it } from "vitest";
import { listSolidProfileGeometry } from "../analysis/ProfileGeometry.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { createEmptySketch } from "../model/Sketch.ts";
import {
  createCommandHistory,
  executeCommand,
  undoCommand,
} from "./Command.ts";
import {
  createAddLineCommand,
  createAddPointCommand,
} from "./CreateGeometryCommand.ts";
import { createAddRectangleCommand } from "./CreateRectangleCommand.ts";
import { createToggleConstructionCommand } from "./ToggleConstructionCommand.ts";

describe("toggle construction", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("creates geometry as construction when requested", () => {
    const command = createAddPointCommand(
      { x: 1, y: 2 },
      { construction: true },
    );
    const applied = executeCommand(
      createCommandHistory(),
      createEmptySketch(),
      command,
    );
    expect(applied.sketch.geometry[0]?.construction).toBe(true);
  });

  it("toggles selected geometry and undoes", () => {
    const add = createAddLineCommand({ x: 0, y: 0 }, { x: 10, y: 0 })!;
    const created = executeCommand(
      createCommandHistory(),
      createEmptySketch(),
      add,
    );
    const lineId = created.sketch.geometry[0]!.id;
    const toggle = createToggleConstructionCommand(created.sketch, [lineId]);
    expect(toggle).not.toBeNull();
    const toggled = executeCommand(created.history, created.sketch, toggle!);
    expect(toggled.sketch.geometry[0]?.construction).toBe(true);
    const undone = undoCommand(toggled.history, toggled.sketch);
    expect(undone.sketch.geometry[0]?.construction).toBe(false);
  });

  it("toggles a whole rectangle feature together", () => {
    const add = createAddRectangleCommand({ x: 0, y: 0 }, { x: 20, y: 10 })!;
    const created = executeCommand(
      createCommandHistory(),
      createEmptySketch(),
      add,
    );
    const cornerId = created.sketch.geometry.find((e) => e.type === "point")!.id;
    const toggle = createToggleConstructionCommand(created.sketch, [cornerId])!;
    const toggled = executeCommand(created.history, created.sketch, toggle);
    expect(toggled.sketch.geometry.every((e) => e.construction)).toBe(true);
  });

  it("excludes construction from solid profile candidates", () => {
    const solid = createAddLineCommand({ x: 0, y: 0 }, { x: 10, y: 0 })!;
    const constr = createAddLineCommand(
      { x: 0, y: 5 },
      { x: 10, y: 5 },
      { construction: true },
    )!;
    let sketch = createEmptySketch();
    sketch = executeCommand(createCommandHistory(), sketch, solid).sketch;
    sketch = executeCommand(createCommandHistory(), sketch, constr).sketch;
    const profile = listSolidProfileGeometry(sketch.geometry);
    expect(profile).toHaveLength(1);
    expect(profile[0]?.construction).toBe(false);
  });
});
