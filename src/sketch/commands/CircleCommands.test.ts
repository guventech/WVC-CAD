import { beforeEach, describe, expect, it } from "vitest";
import {
  addCircleToSketch,
  createAddCircleCommand,
  createCircleGeometry,
} from "./CreateGeometryCommand.ts";
import {
  createCommandHistory,
  executeCommand,
  undoCommand,
} from "./Command.ts";
import { createMoveGeometryCommand } from "./GeometryEdit.ts";
import {
  moveCircleCenterInSketch,
  moveCircleRadiusInSketch,
  moveDraggableInSketch,
} from "./MovePointCommand.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { createEmptySketch } from "../model/Sketch.ts";

describe("circle geometry commands", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("creates a circle with positive radius", () => {
    const result = addCircleToSketch(
      createEmptySketch(),
      { x: 0, y: 0 },
      20,
    );
    expect(result).not.toBeNull();
    expect(result!.circle.center).toEqual({ x: 0, y: 0 });
    expect(result!.circle.radius).toBe(20);
  });

  it("rejects zero and negative radius", () => {
    expect(createCircleGeometry({ x: 0, y: 0 }, 0)).toBeNull();
    expect(createCircleGeometry({ x: 0, y: 0 }, -5)).toBeNull();
    expect(
      createAddCircleCommand({ x: 0, y: 0 }, { x: 0, y: 0 }),
    ).toBeNull();
  });

  it("moving the center preserves radius", () => {
    const created = addCircleToSketch(
      createEmptySketch(),
      { x: 10, y: 10 },
      25,
    )!;
    const moved = moveCircleCenterInSketch(created.sketch, created.circle.id, {
      x: 40,
      y: -5,
    });
    const circle = moved.geometry[0];
    expect(circle?.type).toBe("circle");
    if (circle?.type === "circle") {
      expect(circle.center).toEqual({ x: 40, y: -5 });
      expect(circle.radius).toBe(25);
    }
  });

  it("undo removes a created circle", () => {
    const command = createAddCircleCommand({ x: 0, y: 0 }, { x: 30, y: 0 });
    expect(command).not.toBeNull();
    const applied = executeCommand(
      createCommandHistory(),
      createEmptySketch(),
      command!,
    );
    expect(applied.sketch.geometry).toHaveLength(1);
    const undone = undoCommand(applied.history, applied.sketch);
    expect(undone.sketch.geometry).toHaveLength(0);
  });

  it("resizes radius from a rim point without moving the center", () => {
    const created = addCircleToSketch(
      createEmptySketch(),
      { x: 0, y: 0 },
      20,
    )!;
    const resized = moveCircleRadiusInSketch(created.sketch, created.circle.id, {
      x: 35,
      y: 0,
    });
    const circle = resized.geometry[0];
    expect(circle?.type).toBe("circle");
    if (circle?.type === "circle") {
      expect(circle.center).toEqual({ x: 0, y: 0 });
      expect(circle.radius).toBe(35);
    }

    const rejected = moveCircleRadiusInSketch(
      created.sketch,
      created.circle.id,
      { x: 0, y: 0 },
    );
    expect(rejected).toBe(created.sketch);
  });

  it("does not create a move command for no-op radius drags", () => {
    const created = addCircleToSketch(
      createEmptySketch(),
      { x: 0, y: 0 },
      20,
    )!;
    const target = {
      kind: "circle-radius" as const,
      entityId: created.circle.id,
    };
    // Tangential move at same radius.
    expect(
      createMoveGeometryCommand(
        created.sketch,
        target,
        { x: 20, y: 0 },
        { x: 0, y: 20 },
      ),
    ).toBeNull();
    // Zero radius rejected.
    expect(
      createMoveGeometryCommand(
        created.sketch,
        target,
        { x: 20, y: 0 },
        { x: 0, y: 0 },
      ),
    ).toBeNull();
  });

  it("moveDraggableInSketch routes circle centers", () => {
    const created = addCircleToSketch(
      createEmptySketch(),
      { x: 0, y: 0 },
      15,
    )!;
    const moved = moveDraggableInSketch(created.sketch, created.circle.id, {
      x: 5,
      y: 5,
    });
    const circle = moved.geometry[0];
    expect(circle?.type).toBe("circle");
    if (circle?.type === "circle") {
      expect(circle.center).toEqual({ x: 5, y: 5 });
      expect(circle.radius).toBe(15);
    }
  });
});
