import { beforeEach, describe, expect, it } from "vitest";
import { prepareAddConstraint } from "../commands/AddMaintainedConstraintCommand.ts";
import {
  addArcToSketch,
  addCircleToSketch,
  addLineToSketch,
} from "../commands/CreateGeometryCommand.ts";
import { createAddRectangleCommand } from "../commands/CreateRectangleCommand.ts";
import {
  createCommandHistory,
  executeCommand,
} from "../commands/Command.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import {
  parseRectangleFeature,
} from "../model/RectangleFeature.ts";
import { createEmptySketch } from "../model/Sketch.ts";
import { createSelectionState } from "../selection/SelectionManager.ts";
import { createCamera } from "../viewport/Camera.ts";
import { handleSelectPointerDown } from "./SelectTool.ts";
import type { ToolPointerContext } from "./ToolTypes.ts";

function contextFor(
  sketch: ReturnType<typeof createEmptySketch>,
  worldPoint: { x: number; y: number },
): ToolPointerContext {
  return {
    worldPoint,
    camera: createCamera(800, 600, 2),
    sketch,
    selection: createSelectionState(),
    modifiers: { shift: false, ctrl: false, meta: false },
  };
}

describe("SelectTool geometry drag", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("begins line-endpoint drag on a free line endpoint", () => {
    const created = addLineToSketch(
      createEmptySketch(),
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    )!;

    const result = handleSelectPointerDown(
      contextFor(created.sketch, { x: 0, y: 0 }),
    );

    expect(result.beginPointDrag?.target).toEqual({
      kind: "line-endpoint",
      entityId: created.line.id,
      which: "start",
    });
  });

  it("begins line-body drag on a free line edge", () => {
    const created = addLineToSketch(
      createEmptySketch(),
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    )!;

    const result = handleSelectPointerDown(
      contextFor(created.sketch, { x: 50, y: 0 }),
    );

    expect(result.beginPointDrag?.target.kind).toBe("line-body");
    expect(result.beginPointDrag?.target).toMatchObject({
      kind: "line-body",
      entityId: created.line.id,
      span: { x: 100, y: 0 },
    });
  });

  it("begins rectangle-edge drag and selects the whole rectangle feature", () => {
    const created = executeCommand(
      createCommandHistory(),
      createEmptySketch(),
      createAddRectangleCommand({ x: 0, y: 0 }, { x: 100, y: 50 })!,
    );
    const feature = parseRectangleFeature(
      created.sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;

    const result = handleSelectPointerDown(
      contextFor(created.sketch, { x: 100, y: 25 }),
    );

    expect(result.beginPointDrag?.target).toEqual({
      kind: "rectangle-edge",
      entityId: feature.edges.right,
      edge: "right",
    });
    expect(result.selection?.selectedIds).toEqual(
      expect.arrayContaining([
        feature.corners.bl,
        feature.edges.right,
        feature.edges.top,
      ]),
    );
    expect(result.selection?.selectedIds).toHaveLength(8);
  });

  it("maps rectangle edge endpoint hits to corner-point drag", () => {
    const created = executeCommand(
      createCommandHistory(),
      createEmptySketch(),
      createAddRectangleCommand({ x: 0, y: 0 }, { x: 100, y: 50 })!,
    );
    const feature = parseRectangleFeature(
      created.sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;

    const result = handleSelectPointerDown(
      contextFor(created.sketch, { x: 100, y: 50 }),
    );

    expect(result.beginPointDrag?.target).toEqual({
      kind: "point",
      entityId: feature.corners.tr,
    });
  });

  it("begins circle-radius drag on the circumference", () => {
    const created = addCircleToSketch(createEmptySketch(), { x: 0, y: 0 }, 40)!;
    const result = handleSelectPointerDown(
      contextFor(created.sketch, { x: 40, y: 0 }),
    );
    expect(result.beginPointDrag?.target).toEqual({
      kind: "circle-radius",
      entityId: created.circle.id,
    });
  });

  it("begins arc-radius drag on the arc edge", () => {
    const created = addArcToSketch(
      createEmptySketch(),
      { x: 0, y: 0 },
      30,
      0,
      Math.PI / 2,
    )!;
    const result = handleSelectPointerDown(
      contextFor(created.sketch, { x: 21.213, y: 21.213 }),
    );
    expect(result.beginPointDrag?.target).toEqual({
      kind: "arc-radius",
      entityId: created.arc.id,
    });
  });

  it("does not begin rim drag when a driving radius dimension exists", () => {
    const created = addCircleToSketch(createEmptySketch(), { x: 0, y: 0 }, 40)!;
    const added = prepareAddConstraint(created.sketch, {
      type: "radius",
      references: [{ entityId: created.circle.id, role: "entity" }],
    });
    expect(added.ok).toBe(true);
    if (!added.ok) {
      return;
    }
    const result = handleSelectPointerDown(
      contextFor(added.sketch, { x: 40, y: 0 }),
    );
    expect(result.beginPointDrag).toBeUndefined();
    expect(result.selection?.selectedIds).toContain(created.circle.id);
  });

  it("does not begin rim drag when a driving diameter dimension exists", () => {
    const created = addCircleToSketch(createEmptySketch(), { x: 0, y: 0 }, 25)!;
    const added = prepareAddConstraint(created.sketch, {
      type: "diameter",
      references: [{ entityId: created.circle.id, role: "entity" }],
    });
    expect(added.ok).toBe(true);
    if (!added.ok) {
      return;
    }
    const result = handleSelectPointerDown(
      contextFor(added.sketch, { x: 25, y: 0 }),
    );
    expect(result.beginPointDrag).toBeUndefined();
  });

  it("still begins center drag when radius is dimensioned", () => {
    const created = addCircleToSketch(createEmptySketch(), { x: 10, y: 20 }, 40)!;
    const added = prepareAddConstraint(created.sketch, {
      type: "radius",
      references: [{ entityId: created.circle.id, role: "entity" }],
    });
    expect(added.ok).toBe(true);
    if (!added.ok) {
      return;
    }
    const result = handleSelectPointerDown(
      contextFor(added.sketch, { x: 10, y: 20 }),
    );
    expect(result.beginPointDrag?.target).toEqual({
      kind: "circle-center",
      entityId: created.circle.id,
    });
  });

  it("does not begin arc rim drag when a driving radius exists", () => {
    const created = addArcToSketch(
      createEmptySketch(),
      { x: 0, y: 0 },
      30,
      0,
      Math.PI / 2,
    )!;
    const added = prepareAddConstraint(created.sketch, {
      type: "radius",
      references: [{ entityId: created.arc.id, role: "entity" }],
    });
    expect(added.ok).toBe(true);
    if (!added.ok) {
      return;
    }
    const result = handleSelectPointerDown(
      contextFor(added.sketch, { x: 21.213, y: 21.213 }),
    );
    expect(result.beginPointDrag).toBeUndefined();
  });
});
