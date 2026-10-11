import { beforeEach, describe, expect, it } from "vitest";
import {
  createCommandHistory,
  executeCommand,
  undoCommand,
} from "../commands/Command.ts";
import { addLineToSketch, addPointToSketch } from "../commands/CreateGeometryCommand.ts";
import { createAddCircleCommand } from "../commands/CreateGeometryCommand.ts";
import { createMirrorCommand } from "../commands/MirrorCommand.ts";
import {
  reflectPointAcrossLine,
  mirrorGeometryAcrossLine,
} from "../geometry/MirrorMath.ts";
import {
  applyMirror,
  mirrorAboutWorldXAxis,
  mirrorAboutWorldYAxis,
} from "../geometry/MirrorOps.ts";
import { normalizeAngle, pointsApproximatelyEqual } from "../geometry/GeometryMath.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { DATUM_AXIS_X_ID, DATUM_AXIS_Y_ID } from "../model/SketchFrame.ts";
import { createEmptySketch } from "../model/Sketch.ts";
import { createArcGeometry } from "../commands/CreateGeometryCommand.ts";

describe("Mirror", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("reflects a point across the X axis", () => {
    expect(
      reflectPointAcrossLine({ x: 10, y: 20 }, { x: 0, y: 0 }, { x: 1, y: 0 }),
    ).toEqual({ x: 10, y: -20 });
  });

  it("mirrors a line about the world Y axis", () => {
    let sketch = createEmptySketch();
    sketch = addLineToSketch(sketch, { x: 10, y: 0 }, { x: 40, y: 30 })!.sketch;
    const outcome = mirrorAboutWorldYAxis(sketch, [sketch.geometry[0]!.id]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }
    const mirrored = outcome.sketch.geometry[1];
    expect(mirrored?.type).toBe("line");
    if (mirrored?.type !== "line") {
      return;
    }
    expect(mirrored.start.x).toBeCloseTo(-10);
    expect(mirrored.end.x).toBeCloseTo(-40);
    expect(mirrored.end.y).toBeCloseTo(30);
  });

  it("mirrors about a construction line", () => {
    let sketch = createEmptySketch();
    sketch = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 0, y: 50 }, {
      construction: true,
    })!.sketch;
    sketch = addPointToSketch(sketch, { x: 20, y: 10 })!.sketch;
    const axisId = sketch.geometry[0]!.id;
    const pointId = sketch.geometry[1]!.id;

    const outcome = applyMirror(sketch, [pointId], {
      kind: "line",
      entityId: axisId,
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }
    const mirrored = outcome.sketch.geometry.find((e) => e.type === "point" && e.id !== pointId);
    expect(mirrored?.type).toBe("point");
    if (mirrored?.type !== "point") {
      return;
    }
    expect(mirrored.position.x).toBeCloseTo(-20);
    expect(mirrored.position.y).toBeCloseTo(10);
  });

  it("mirrors a circle center across X axis", () => {
    let sketch = createEmptySketch();
    const add = createAddCircleCommand({ x: 5, y: 15 }, { x: 5, y: 25 })!;
    sketch = add.apply(sketch);
    const outcome = mirrorAboutWorldXAxis(sketch, [sketch.geometry[0]!.id]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }
    const mirrored = outcome.sketch.geometry[1];
    expect(mirrored?.type).toBe("circle");
    if (mirrored?.type !== "circle") {
      return;
    }
    expect(mirrored.center).toEqual({ x: 5, y: -15 });
    expect(mirrored.radius).toBeCloseTo(10);
  });

  it("preserves arc CCW after reflection (orientation flip)", () => {
    const arc = createArcGeometry(
      { x: 0, y: 0 },
      10,
      0,
      Math.PI / 2,
    )!;
    const mirrored = mirrorGeometryAcrossLine(arc, { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(mirrored.type).toBe("arc");
    if (mirrored.type !== "arc") {
      return;
    }
    expect(pointsApproximatelyEqual(mirrored.center, { x: 0, y: 0 })).toBe(true);
    // Original CCW 0→π/2 mirrors to CW 0→−π/2, stored as CCW −π/2→0
    expect(normalizeAngle(mirrored.startAngle)).toBeCloseTo(normalizeAngle(-Math.PI / 2));
    expect(normalizeAngle(mirrored.endAngle)).toBeCloseTo(0);
  });

  it("does not copy constraints", () => {
    let sketch = createEmptySketch();
    sketch = addLineToSketch(sketch, { x: 10, y: 0 }, { x: 40, y: 0 })!.sketch;
    // Leave constraints empty — ensure count stays 0 after mirror
    const outcome = applyMirror(sketch, [sketch.geometry[0]!.id], {
      kind: "frame-axis",
      entityId: DATUM_AXIS_Y_ID,
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }
    expect(outcome.sketch.constraints).toHaveLength(0);
    expect(outcome.sketch.geometry).toHaveLength(2);
  });

  it("command path copies remappable constraints and undo restores both arrays", () => {
    let sketch = createEmptySketch();
    sketch = addLineToSketch(sketch, { x: 10, y: 5 }, { x: 30, y: 5 })!.sketch;
    const lineId = sketch.geometry[0]!.id;
    sketch = {
      ...sketch,
      constraints: [
        {
          id: "c-h",
          type: "horizontal",
          references: [{ entityId: lineId, role: "entity" }],
        },
      ],
    };
    const beforeGeometry = sketch.geometry;
    const beforeConstraints = sketch.constraints;

    const cmd = createMirrorCommand(sketch, [lineId], {
      kind: "frame-axis",
      entityId: DATUM_AXIS_X_ID,
    });
    expect(cmd.ok).toBe(true);
    if (!cmd.ok) {
      return;
    }

    const history = createCommandHistory();
    const result = executeCommand(history, sketch, cmd.command);
    expect(result.sketch.geometry).toHaveLength(2);
    expect(result.sketch.constraints).toHaveLength(2);
    expect(result.sketch.constraints.filter((c) => c.type === "horizontal")).toHaveLength(
      2,
    );

    const undone = undoCommand(result.history, result.sketch);
    expect(undone.sketch.geometry).toEqual(beforeGeometry);
    expect(undone.sketch.constraints).toEqual(beforeConstraints);
  });
});
