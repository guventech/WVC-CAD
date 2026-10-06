import { beforeEach, describe, expect, it } from "vitest";
import {
  addArcToSketch,
  createAddArcCommand,
  createArcGeometry,
} from "./CreateGeometryCommand.ts";
import {
  createCommandHistory,
  executeCommand,
  undoCommand,
} from "./Command.ts";
import {
  moveArcCenterInSketch,
  moveArcRadiusInSketch,
  moveDraggableInSketch,
} from "./MovePointCommand.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { createEmptySketch } from "../model/Sketch.ts";
import { arcSweepRadians, normalizeAngle } from "../geometry/GeometryMath.ts";

describe("arc geometry commands", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("creates a CCW quarter arc", () => {
    const result = addArcToSketch(
      createEmptySketch(),
      { x: 0, y: 0 },
      20,
      0,
      Math.PI / 2,
    );
    expect(result).not.toBeNull();
    expect(result!.arc.radius).toBe(20);
    expect(arcSweepRadians(result!.arc.startAngle, result!.arc.endAngle)).toBeCloseTo(
      Math.PI / 2,
    );
  });

  it("stores arcs that cross 0° with wrapping sweep", () => {
    const result = addArcToSketch(
      createEmptySketch(),
      { x: 0, y: 0 },
      10,
      (3 * Math.PI) / 2,
      Math.PI / 2,
    );
    expect(result).not.toBeNull();
    expect(arcSweepRadians(result!.arc.startAngle, result!.arc.endAngle)).toBeCloseTo(
      Math.PI,
    );
  });

  it("rejects zero radius and degenerate sweep", () => {
    expect(createArcGeometry({ x: 0, y: 0 }, 0, 0, Math.PI / 2)).toBeNull();
    expect(createArcGeometry({ x: 0, y: 0 }, 10, 0, 0)).toBeNull();
    expect(createArcGeometry({ x: 0, y: 0 }, 10, 0, Math.PI * 2)).toBeNull();
    expect(
      createAddArcCommand({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 0 }),
    ).toBeNull();
  });

  it("resizes radius from a rim point without moving center or angles", () => {
    const created = addArcToSketch(
      createEmptySketch(),
      { x: 0, y: 0 },
      15,
      0,
      Math.PI / 2,
    )!;
    const resized = moveArcRadiusInSketch(created.sketch, created.arc.id, {
      x: 40,
      y: 0,
    });
    const arc = resized.geometry[0];
    expect(arc?.type).toBe("arc");
    if (arc?.type === "arc") {
      expect(arc.center).toEqual({ x: 0, y: 0 });
      expect(arc.radius).toBe(40);
      expect(normalizeAngle(arc.startAngle)).toBeCloseTo(0);
      expect(normalizeAngle(arc.endAngle)).toBeCloseTo(Math.PI / 2);
    }
  });

  it("moving the center preserves radius and angles", () => {
    const created = addArcToSketch(
      createEmptySketch(),
      { x: 5, y: 5 },
      15,
      0,
      Math.PI / 2,
    )!;
    const moved = moveArcCenterInSketch(created.sketch, created.arc.id, {
      x: 40,
      y: -5,
    });
    const arc = moved.geometry[0];
    expect(arc?.type).toBe("arc");
    if (arc?.type === "arc") {
      expect(arc.center).toEqual({ x: 40, y: -5 });
      expect(arc.radius).toBe(15);
      expect(normalizeAngle(arc.startAngle)).toBeCloseTo(0);
      expect(normalizeAngle(arc.endAngle)).toBeCloseTo(Math.PI / 2);
    }
  });

  it("undo removes a created arc", () => {
    const command = createAddArcCommand(
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 0, y: 30 },
    );
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

  it("moveDraggableInSketch routes arc centers", () => {
    const created = addArcToSketch(
      createEmptySketch(),
      { x: 0, y: 0 },
      12,
      0,
      Math.PI,
    )!;
    const moved = moveDraggableInSketch(created.sketch, created.arc.id, {
      x: 3,
      y: 4,
    });
    const arc = moved.geometry[0];
    expect(arc?.type).toBe("arc");
    if (arc?.type === "arc") {
      expect(arc.center).toEqual({ x: 3, y: 4 });
      expect(arc.radius).toBe(12);
    }
  });
});
