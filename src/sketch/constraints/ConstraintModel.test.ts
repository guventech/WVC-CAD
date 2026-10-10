import { beforeEach, describe, expect, it } from "vitest";
import {
  createCommandHistory,
  executeCommand,
  undoCommand,
} from "../commands/Command.ts";
import {
  addConstraintToSketch,
  createAddConstraintCommand,
} from "../commands/AddConstraintCommand.ts";
import { createAddRectangleCommand } from "../commands/CreateRectangleCommand.ts";
import { addLineToSketch } from "../commands/CreateGeometryCommand.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { createEmptySketch } from "../model/Sketch.ts";
import {
  createLengthConstraint,
  createRadiusConstraint,
} from "./ConstraintFactory.ts";
import {
  buildConstraintGraph,
  constraintsForEntity,
} from "./ConstraintGraph.ts";
import {
  CONSTRAINT_TYPE_CATALOG,
  getConstraintTypeInfo,
  listConstraintTypes,
} from "./ConstraintTypes.ts";
import {
  validateAllConstraints,
  validateConstraintStructure,
} from "./ConstraintValidator.ts";

describe("constraint data model (Chunk 10)", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("catalogs geometric, feature, and dimensional types", () => {
    expect(CONSTRAINT_TYPE_CATALOG.length).toBeGreaterThanOrEqual(21);
    expect(listConstraintTypes("geometric").length).toBe(12);
    expect(listConstraintTypes("feature").length).toBe(3);
    expect(listConstraintTypes("dimensional").length).toBe(9);
    expect(getConstraintTypeInfo("coincident")?.minReferences).toBe(2);
    expect(getConstraintTypeInfo("length")?.requiresValue).toBe(true);
    expect(getConstraintTypeInfo("rectangle")?.category).toBe("feature");
  });

  it("indexes rectangle constraints by entity", () => {
    const created = executeCommand(
      createCommandHistory(),
      createEmptySketch(),
      createAddRectangleCommand({ x: 0, y: 0 }, { x: 40, y: 20 })!,
    );
    const graph = buildConstraintGraph(created.sketch.constraints);
    const edge = created.sketch.geometry.find((entity) => entity.type === "line");
    expect(edge).toBeDefined();
    const ids = constraintsForEntity(graph, edge!.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(
      created.sketch.constraints.some(
        (constraint) =>
          constraint.type === "rectangle" && ids.includes(constraint.id),
      ),
    ).toBe(true);
  });

  it("structurally validates dimensional constraints and rejects bad refs", () => {
    const created = addLineToSketch(
      createEmptySketch(),
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    )!;
    const length = createLengthConstraint("len-1", created.line.id, 10);
    expect(validateConstraintStructure(created.sketch, length).ok).toBe(true);

    const missing = createRadiusConstraint("r-1", "no-such-circle", 5);
    expect(validateConstraintStructure(created.sketch, missing).ok).toBe(false);

    const noValue = {
      id: "len-bad",
      type: "length" as const,
      references: [{ entityId: created.line.id, role: "entity" as const }],
    };
    expect(validateConstraintStructure(created.sketch, noValue).ok).toBe(false);
  });

  it("adds constraints through an undoable command without claiming solve", () => {
    const created = addLineToSketch(
      createEmptySketch(),
      { x: 0, y: 0 },
      { x: 25, y: 0 },
    )!;
    const length = createLengthConstraint("len-25", created.line.id, 25, {
      driving: true,
    });
    const applied = executeCommand(
      createCommandHistory(),
      created.sketch,
      createAddConstraintCommand(length),
    );
    expect(applied.sketch.constraints).toHaveLength(1);
    expect(validateAllConstraints(applied.sketch).ok).toBe(true);

    const undone = undoCommand(applied.history, applied.sketch);
    expect(undone.sketch.constraints).toHaveLength(0);

    // Rejected inserts leave the sketch unchanged.
    const rejected = addConstraintToSketch(created.sketch, {
      id: "bad",
      type: "length",
      references: [{ entityId: "missing", role: "entity" }],
      value: 1,
    });
    expect(rejected).toBe(created.sketch);
  });
});
