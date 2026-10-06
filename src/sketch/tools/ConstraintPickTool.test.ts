import { beforeEach, describe, expect, it } from "vitest";
import {
  addCircleToSketch,
  addLineToSketch,
  addPointToSketch,
} from "../commands/CreateGeometryCommand.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { createEmptySketch, type Sketch } from "../model/Sketch.ts";
import { createSelectionState } from "../selection/SelectionManager.ts";
import { createCamera } from "../viewport/Camera.ts";
import type { ConstraintPickToolId } from "./ActiveTool.ts";
import {
  createConstraintPickToolState,
  handleConstraintPickToolPointerDown,
  interpretConstraintPick,
  type ConstraintPickToolState,
} from "./ConstraintPickTool.ts";

function click(
  tool: ConstraintPickToolId,
  sketch: Sketch,
  worldPoint: { x: number; y: number },
  state: ConstraintPickToolState = createConstraintPickToolState(),
) {
  return handleConstraintPickToolPointerDown(
    tool,
    {
      worldPoint,
      camera: createCamera(800, 600, 2),
      sketch,
      selection: createSelectionState(),
      modifiers: { shift: false, ctrl: false, meta: false },
    },
    state,
  );
}

describe("ConstraintPickTool", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("Horizontal: one click on a line edge requests H on the line", () => {
    const created = addLineToSketch(createEmptySketch(), { x: 0, y: 0 }, { x: 40, y: 5 })!;
    const handled = click("horizontal", created.sketch, { x: 20, y: 2.5 });
    expect(handled.result.createConstraint).toEqual({
      type: "horizontal",
      references: [{ entityId: created.line.id, role: "entity" }],
    });
    expect(handled.state.first).toBeNull();
  });

  it("Vertical: two point picks request a two-point constraint", () => {
    let sketch = createEmptySketch();
    const a = addPointToSketch(sketch, { x: 0, y: 0 });
    sketch = a.sketch;
    const b = addPointToSketch(sketch, { x: 5, y: 30 });
    sketch = b.sketch;
    const first = click("vertical", sketch, { x: 0, y: 0 });
    expect(first.result.creationSessionActive).toBe(true);
    const second = click("vertical", sketch, { x: 5, y: 30 }, first.state);
    expect(second.result.createConstraint).toEqual({
      type: "vertical",
      references: [
        { entityId: a.point.id, role: "position" },
        { entityId: b.point.id, role: "position" },
      ],
    });
  });

  it("Radius: clicking a circle rim or center requests radius", () => {
    const created = addCircleToSketch(createEmptySketch(), { x: 0, y: 0 }, 20)!;
    for (const point of [{ x: 20, y: 0 }, { x: 0, y: 0 }]) {
      expect(click("dim-radius", created.sketch, point).result.createConstraint).toEqual({
        type: "radius",
        references: [{ entityId: created.circle.id, role: "entity" }],
      });
    }
  });

  it("H distance on a line expands to its two endpoints", () => {
    const created = addLineToSketch(createEmptySketch(), { x: 0, y: 0 }, { x: 40, y: 10 })!;
    expect(
      click("dim-horizontal-distance", created.sketch, { x: 20, y: 5 }).result.createConstraint,
    ).toEqual({
      type: "horizontal-distance",
      references: [
        { entityId: created.line.id, role: "start" },
        { entityId: created.line.id, role: "end" },
      ],
    });
  });

  it("Angle needs two distinct lines", () => {
    const line = { kind: "line" as const, ref: { entityId: "l1", role: "entity" as const } };
    const other = { kind: "line" as const, ref: { entityId: "l2", role: "entity" as const } };
    expect(interpretConstraintPick("dim-angle", null, line).kind).toBe("await-second");
    expect(interpretConstraintPick("dim-angle", line, line).kind).toBe("ignore");
    expect(interpretConstraintPick("dim-angle", line, other)).toEqual({
      kind: "create",
      request: { type: "angle", references: [line.ref, other.ref] },
    });
  });

  it("Parallel: two line picks request parallel", () => {
    let sketch = createEmptySketch();
    const a = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 40, y: 0 })!;
    sketch = a.sketch;
    const b = addLineToSketch(sketch, { x: 0, y: 10 }, { x: 40, y: 15 })!;
    sketch = b.sketch;
    const first = click("parallel", sketch, { x: 20, y: 0 });
    expect(first.result.creationSessionActive).toBe(true);
    const second = click("parallel", sketch, { x: 20, y: 12.5 }, first.state);
    expect(second.result.createConstraint).toEqual({
      type: "parallel",
      references: [
        { entityId: a.line.id, role: "entity" },
        { entityId: b.line.id, role: "entity" },
      ],
    });
  });

  it("Perpendicular: ignores a second click on the same line", () => {
    const line = { kind: "line" as const, ref: { entityId: "l1", role: "entity" as const } };
    expect(interpretConstraintPick("perpendicular", null, line).kind).toBe("await-second");
    expect(interpretConstraintPick("perpendicular", line, line).kind).toBe("ignore");
  });

  it("Tangent: line then circle requests tangent", () => {
    let sketch = createEmptySketch();
    const line = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 80, y: 0 })!;
    sketch = line.sketch;
    // Keep the circle clear of the line so picks are unambiguous.
    const circle = addCircleToSketch(sketch, { x: 40, y: 40 }, 10)!;
    sketch = circle.sketch;
    const first = click("tangent", sketch, { x: 20, y: 0 });
    expect(first.result.creationSessionActive).toBe(true);
    const second = click("tangent", sketch, { x: 50, y: 40 }, first.state);
    expect(second.result.createConstraint).toEqual({
      type: "tangent",
      references: [
        { entityId: line.line.id, role: "entity" },
        { entityId: circle.circle.id, role: "entity" },
      ],
    });
  });

  it("Tangent: ignores two lines", () => {
    const a = { kind: "line" as const, ref: { entityId: "l1", role: "entity" as const } };
    const b = { kind: "line" as const, ref: { entityId: "l2", role: "entity" as const } };
    expect(interpretConstraintPick("tangent", a, b).kind).toBe("ignore");
  });

  it("Concentric: two circle picks request concentric", () => {
    let sketch = createEmptySketch();
    const a = addCircleToSketch(sketch, { x: 0, y: 0 }, 10)!;
    sketch = a.sketch;
    const b = addCircleToSketch(sketch, { x: 30, y: 0 }, 15)!;
    sketch = b.sketch;
    const first = click("concentric", sketch, { x: 10, y: 0 });
    expect(first.result.creationSessionActive).toBe(true);
    const second = click("concentric", sketch, { x: 45, y: 0 }, first.state);
    expect(second.result.createConstraint).toEqual({
      type: "concentric",
      references: [
        { entityId: a.circle.id, role: "entity" },
        { entityId: b.circle.id, role: "entity" },
      ],
    });
  });

  it("Concentric: ignores lines", () => {
    const line = { kind: "line" as const, ref: { entityId: "l1", role: "entity" as const } };
    const curve = { kind: "curve" as const, ref: { entityId: "c1", role: "entity" as const } };
    expect(interpretConstraintPick("concentric", null, line).kind).toBe("ignore");
    expect(interpretConstraintPick("concentric", curve, line).kind).toBe("ignore");
  });

  it("Midpoint: point then line requests midpoint", () => {
    let sketch = createEmptySketch();
    const line = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 40, y: 0 })!;
    sketch = line.sketch;
    const point = addPointToSketch(sketch, { x: 10, y: 10 });
    sketch = point.sketch;
    const first = click("midpoint", sketch, { x: 10, y: 10 });
    expect(first.result.creationSessionActive).toBe(true);
    const second = click("midpoint", sketch, { x: 20, y: 0 }, first.state);
    expect(second.result.createConstraint).toEqual({
      type: "midpoint",
      references: [
        { entityId: point.point.id, role: "position" },
        { entityId: line.line.id, role: "entity" },
      ],
    });
  });

  it("Midpoint: ignores two points", () => {
    const a = {
      kind: "point-like" as const,
      ref: { entityId: "p1", role: "position" as const },
    };
    const b = {
      kind: "point-like" as const,
      ref: { entityId: "p2", role: "position" as const },
    };
    expect(interpretConstraintPick("midpoint", a, b).kind).toBe("ignore");
  });

  it("Equal: two line picks request equal", () => {
    let sketch = createEmptySketch();
    const a = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 40, y: 0 })!;
    sketch = a.sketch;
    const b = addLineToSketch(sketch, { x: 0, y: 10 }, { x: 20, y: 10 })!;
    sketch = b.sketch;
    const first = click("equal", sketch, { x: 20, y: 0 });
    expect(first.result.creationSessionActive).toBe(true);
    const second = click("equal", sketch, { x: 10, y: 10 }, first.state);
    expect(second.result.createConstraint).toEqual({
      type: "equal",
      references: [
        { entityId: a.line.id, role: "entity" },
        { entityId: b.line.id, role: "entity" },
      ],
    });
  });

  it("Equal: two circle picks request equal", () => {
    let sketch = createEmptySketch();
    const a = addCircleToSketch(sketch, { x: 0, y: 0 }, 10)!;
    sketch = a.sketch;
    const b = addCircleToSketch(sketch, { x: 30, y: 0 }, 15)!;
    sketch = b.sketch;
    const first = click("equal", sketch, { x: 10, y: 0 });
    const second = click("equal", sketch, { x: 45, y: 0 }, first.state);
    expect(second.result.createConstraint).toEqual({
      type: "equal",
      references: [
        { entityId: a.circle.id, role: "entity" },
        { entityId: b.circle.id, role: "entity" },
      ],
    });
  });

  it("Equal: ignores mixed line and curve", () => {
    const line = { kind: "line" as const, ref: { entityId: "l1", role: "entity" as const } };
    const curve = { kind: "curve" as const, ref: { entityId: "c1", role: "entity" as const } };
    expect(interpretConstraintPick("equal", line, curve).kind).toBe("ignore");
  });

  it("Symmetric: two points then a line requests symmetric", () => {
    let sketch = createEmptySketch();
    const axis = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 0, y: 40 })!;
    sketch = axis.sketch;
    const a = addPointToSketch(sketch, { x: 10, y: 5 });
    sketch = a.sketch;
    const b = addPointToSketch(sketch, { x: -8, y: 12 });
    sketch = b.sketch;
    const first = click("symmetric", sketch, { x: 10, y: 5 });
    expect(first.result.creationSessionActive).toBe(true);
    const second = click("symmetric", sketch, { x: -8, y: 12 }, first.state);
    expect(second.result.creationSessionActive).toBe(true);
    expect(second.state.second).not.toBeNull();
    const third = click("symmetric", sketch, { x: 0, y: 20 }, second.state);
    expect(third.result.createConstraint).toEqual({
      type: "symmetric",
      references: [
        { entityId: a.point.id, role: "position" },
        { entityId: b.point.id, role: "position" },
        { entityId: axis.line.id, role: "entity" },
      ],
    });
  });

  it("Symmetric: ignores two lines as the first two picks", () => {
    const a = { kind: "line" as const, ref: { entityId: "l1", role: "entity" as const } };
    const b = { kind: "line" as const, ref: { entityId: "l2", role: "entity" as const } };
    expect(interpretConstraintPick("symmetric", a, b).kind).toBe("ignore");
  });

  it("Point-on-object: point then line edge requests point-on-object", () => {
    let sketch = createEmptySketch();
    const line = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 40, y: 0 })!;
    sketch = line.sketch;
    const point = addPointToSketch(sketch, { x: 10, y: 10 });
    sketch = point.sketch;
    const first = click("point-on-object", sketch, { x: 10, y: 10 });
    const second = click("point-on-object", sketch, { x: 20, y: 0 }, first.state);
    expect(second.result.createConstraint).toEqual({
      type: "point-on-object",
      references: [
        { entityId: point.point.id, role: "position" },
        { entityId: line.line.id, role: "entity" },
      ],
    });
  });

  it("Length ignores points and circles", () => {
    const point = { kind: "point-like" as const, ref: { entityId: "p", role: "position" as const } };
    const curve = { kind: "curve" as const, ref: { entityId: "c", role: "entity" as const } };
    expect(interpretConstraintPick("dim-length", null, point).kind).toBe("ignore");
    expect(interpretConstraintPick("dim-length", null, curve).kind).toBe("ignore");
  });

  it("Offset from X-axis: one point pick requests coordinate-y", () => {
    const created = addPointToSketch(createEmptySketch(), { x: 12, y: 34 });
    const handled = click("dim-offset-x-axis", created.sketch, { x: 12, y: 34 });
    expect(handled.result.createConstraint).toEqual({
      type: "coordinate-y",
      references: [{ entityId: created.point.id, role: "position" }],
    });
  });

  it("Offset from Y-axis: one point pick requests coordinate-x", () => {
    const created = addPointToSketch(createEmptySketch(), { x: 12, y: 34 });
    const handled = click("dim-offset-y-axis", created.sketch, { x: 12, y: 34 });
    expect(handled.result.createConstraint).toEqual({
      type: "coordinate-x",
      references: [{ entityId: created.point.id, role: "position" }],
    });
  });

  it("Fix: one point pick requests fix on that handle", () => {
    const created = addPointToSketch(createEmptySketch(), { x: 12, y: 34 });
    const handled = click("fix", created.sketch, { x: 12, y: 34 });
    expect(handled.result.createConstraint).toEqual({
      type: "fix",
      references: [{ entityId: created.point.id, role: "position" }],
    });
  });

  it("Fix: line edge pick requests entity fix", () => {
    const created = addLineToSketch(createEmptySketch(), { x: 0, y: 0 }, { x: 40, y: 0 })!;
    const handled = click("fix", created.sketch, { x: 20, y: 0 });
    expect(handled.result.createConstraint).toEqual({
      type: "fix",
      references: [{ entityId: created.line.id, role: "entity" }],
    });
  });

  it("Fix: circle rim pick requests entity fix", () => {
    const created = addCircleToSketch(createEmptySketch(), { x: 0, y: 0 }, 10)!;
    const handled = click("fix", created.sketch, { x: 10, y: 0 });
    expect(handled.result.createConstraint).toEqual({
      type: "fix",
      references: [{ entityId: created.circle.id, role: "entity" }],
    });
  });

  it("Offset from X-axis accepts a horizontal line as one endpoint", () => {
    const created = addLineToSketch(createEmptySketch(), { x: 10, y: 40 }, { x: 90, y: 40 })!;
    const handled = click("dim-offset-x-axis", created.sketch, { x: 50, y: 40 });
    expect(handled.result.createConstraint).toEqual({
      type: "coordinate-y",
      references: [{ entityId: created.line.id, role: "start" }],
    });
  });

  it("Offset from X-axis ignores a vertical line", () => {
    const created = addLineToSketch(createEmptySketch(), { x: 10, y: 0 }, { x: 10, y: 40 })!;
    expect(
      click("dim-offset-x-axis", created.sketch, { x: 10, y: 20 }).result.createConstraint,
    ).toBeUndefined();
  });
});
