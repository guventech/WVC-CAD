import { beforeEach, describe, expect, it } from "vitest";
import { addLineToSketch } from "../commands/CreateGeometryCommand.ts";
import {
  createCommandHistory,
  executeCommand,
  undoCommand,
} from "../commands/Command.ts";
import {
  createChamferCommand,
  createFilletCommand,
} from "../commands/FilletChamferCommand.ts";
import { applyChamferLines, applyFilletLines, updateFilletRadius } from "./FilletChamferOps.ts";
import {
  computeLineLineChamfer,
  computeLineLineFillet,
} from "./FilletChamferMath.ts";
import { arcSweepRadians, distance } from "./GeometryMath.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { createEmptySketch } from "../model/Sketch.ts";
import { createAddRectangleCommand } from "../commands/CreateRectangleCommand.ts";
import { createEditDimensionCommand } from "../commands/EditDimensionCommand.ts";
import { parseRectangleFeature } from "../model/RectangleFeature.ts";

describe("FilletChamferMath", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("computes a 90° fillet with radius 5", () => {
    const line1 = {
      id: "l1",
      type: "line" as const,
      start: { x: 0, y: 0 },
      end: { x: 100, y: 0 },
      construction: false,
    };
    const line2 = {
      id: "l2",
      type: "line" as const,
      start: { x: 0, y: 0 },
      end: { x: 0, y: 100 },
      construction: false,
    };
    const plan = computeLineLineFillet(line1, line2, 5, { x: 4, y: 4 });
    expect(plan).not.toBeNull();
    expect(plan!.line1Trim.start.x).toBeCloseTo(5);
    expect(plan!.line1Trim.start.y).toBeCloseTo(0);
    expect(plan!.line2Trim.start.x).toBeCloseTo(0);
    expect(plan!.line2Trim.start.y).toBeCloseTo(5);
    expect(plan!.arc.radius).toBeCloseTo(5);
    // Smooth corner fillet is 90°, not the 270° long-way bump.
    expect(plan!.arc.center.x).toBeCloseTo(5);
    expect(plan!.arc.center.y).toBeCloseTo(5);
    expect(arcSweepRadians(plan!.arc.startAngle, plan!.arc.endAngle)).toBeCloseTo(
      Math.PI / 2,
      5,
    );
  });

  it("fillet stays inside the picked corner (not an outside bump)", () => {
    const line1 = {
      id: "l1",
      type: "line" as const,
      start: { x: 0, y: 0 },
      end: { x: 80, y: 0 },
      construction: false,
    };
    const line2 = {
      id: "l2",
      type: "line" as const,
      start: { x: 0, y: 0 },
      end: { x: 0, y: 80 },
      construction: false,
    };
    const plan = computeLineLineFillet(line1, line2, 10, { x: 8, y: 8 });
    expect(plan).not.toBeNull();
    expect(plan!.arc.center.x).toBeGreaterThan(0);
    expect(plan!.arc.center.y).toBeGreaterThan(0);
    expect(arcSweepRadians(plan!.arc.startAngle, plan!.arc.endAngle)).toBeCloseTo(
      Math.PI / 2,
      5,
    );
  });

  it("computes chamfer corners", () => {
    const line1 = {
      id: "l1",
      type: "line" as const,
      start: { x: 0, y: 0 },
      end: { x: 100, y: 0 },
      construction: false,
    };
    const line2 = {
      id: "l2",
      type: "line" as const,
      start: { x: 0, y: 0 },
      end: { x: 0, y: 100 },
      construction: false,
    };
    const plan = computeLineLineChamfer(line1, line2, 8, { x: 3, y: 3 });
    expect(plan).not.toBeNull();
    expect(plan!.chamferLine.start).toEqual({ x: 8, y: 0 });
    expect(plan!.chamferLine.end).toEqual({ x: 0, y: 8 });
    expect(distance(plan!.chamferLine.start, plan!.chamferLine.end)).toBeCloseTo(
      8 * Math.SQRT2,
    );
  });
});

describe("FilletChamfer apply", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("applies fillet and adds an arc entity", () => {
    let sketch = createEmptySketch();
    sketch = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 100, y: 0 })!.sketch;
    sketch = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 0, y: 100 })!.sketch;
    const id1 = sketch.geometry[0]!.id;
    const id2 = sketch.geometry[1]!.id;

    const outcome = applyFilletLines(sketch, id1, id2, { x: 4, y: 4 }, 5);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }
    expect(outcome.sketch.geometry).toHaveLength(3);
    expect(outcome.sketch.geometry.some((e) => e.type === "arc")).toBe(true);
    expect(outcome.sketch.constraints.some((c) => c.type === "fillet")).toBe(true);
    expect(outcome.sketch.constraints.some((c) => c.type === "radius")).toBe(true);
    const arc = outcome.sketch.geometry.find((e) => e.type === "arc");
    expect(arc?.type).toBe("arc");
    if (arc?.type === "arc") {
      expect(arcSweepRadians(arc.startAngle, arc.endAngle)).toBeCloseTo(Math.PI / 2, 5);
    }
  });

  it("keeps fillet lines connected when radius shrinks", () => {
    let sketch = createEmptySketch();
    sketch = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 100, y: 0 })!.sketch;
    sketch = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 0, y: 100 })!.sketch;
    const created = applyFilletLines(
      sketch,
      sketch.geometry[0]!.id,
      sketch.geometry[1]!.id,
      { x: 8, y: 8 },
      10,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const feature = created.sketch.constraints.find((c) => c.type === "fillet");
    expect(feature).toBeDefined();
    const updated = updateFilletRadius(
      created.sketch,
      {
        constraintId: feature!.id,
        line1Id: feature!.references[0]!.entityId,
        line2Id: feature!.references[1]!.entityId,
        arcId: feature!.references[2]!.entityId,
        radiusMm: 10,
      },
      4,
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) {
      return;
    }
    const arc = updated.sketch.geometry.find((e) => e.type === "arc");
    const lines = updated.sketch.geometry.filter((e) => e.type === "line");
    expect(arc?.type).toBe("arc");
    if (arc?.type !== "arc") {
      return;
    }
    expect(arc.radius).toBeCloseTo(4);
    // Arc endpoints must land on the trimmed line ends.
    const start = {
      x: arc.center.x + arc.radius * Math.cos(arc.startAngle),
      y: arc.center.y + arc.radius * Math.sin(arc.startAngle),
    };
    const end = {
      x: arc.center.x + arc.radius * Math.cos(arc.endAngle),
      y: arc.center.y + arc.radius * Math.sin(arc.endAngle),
    };
    const nearStart = lines.some(
      (line) =>
        line.type === "line" &&
        (distance(line.start, start) < 1e-6 || distance(line.end, start) < 1e-6),
    );
    const nearEnd = lines.some(
      (line) =>
        line.type === "line" &&
        (distance(line.start, end) < 1e-6 || distance(line.end, end) < 1e-6),
    );
    expect(nearStart).toBe(true);
    expect(nearEnd).toBe(true);
  });

  it("applies chamfer and adds a connecting line", () => {
    let sketch = createEmptySketch();
    sketch = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 100, y: 0 })!.sketch;
    sketch = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 0, y: 100 })!.sketch;
    const id1 = sketch.geometry[0]!.id;
    const id2 = sketch.geometry[1]!.id;

    const outcome = applyChamferLines(sketch, id1, id2, { x: 3, y: 3 }, 8);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }
    expect(outcome.sketch.geometry.filter((e) => e.type === "line")).toHaveLength(3);
    expect(outcome.sketch.constraints.some((c) => c.type === "chamfer")).toBe(true);
    expect(outcome.sketch.constraints.some((c) => c.type === "length")).toBe(true);
    expect(outcome.sketch.constraints.some((c) => c.type === "angle")).toBe(true);
    const length = outcome.sketch.constraints.find((c) => c.type === "length")!;
    const angle = outcome.sketch.constraints.find((c) => c.type === "angle")!;
    expect(length.value).toBeCloseTo(8 * Math.SQRT2, 6);
    expect(angle.value).toBeCloseTo(Math.PI / 4, 6);
  });

  it("edits chamfer face length and rebuilds the corner", () => {
    let sketch = createEmptySketch();
    sketch = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 100, y: 0 })!.sketch;
    sketch = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 0, y: 100 })!.sketch;
    const created = applyChamferLines(
      sketch,
      sketch.geometry[0]!.id,
      sketch.geometry[1]!.id,
      { x: 4, y: 4 },
      8,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    sketch = created.sketch;
    const lengthId = sketch.constraints.find((c) => c.type === "length")!.id;
    const edit = createEditDimensionCommand(sketch, lengthId, {
      value: 10 * Math.SQRT2,
    });
    expect(edit.ok).toBe(true);
    if (!edit.ok) {
      return;
    }
    sketch = edit.command.apply(sketch);
    const chamfer = sketch.geometry.find(
      (e) => e.type === "line" && sketch.constraints.some(
        (c) => c.type === "chamfer" && c.references.some((r) => r.entityId === e.id && r.role === "entity"),
      ),
    );
    expect(chamfer).toBeDefined();
    if (chamfer?.type !== "line") {
      return;
    }
    expect(distance(chamfer.start, chamfer.end)).toBeCloseTo(10 * Math.SQRT2, 5);
    const angle = sketch.constraints.find((c) => c.type === "angle")!;
    expect(angle.value).toBeCloseTo(Math.PI / 4, 5);
  });

  it("edits chamfer angle and keeps face length", () => {
    let sketch = createEmptySketch();
    sketch = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 100, y: 0 })!.sketch;
    sketch = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 0, y: 100 })!.sketch;
    const created = applyChamferLines(
      sketch,
      sketch.geometry[0]!.id,
      sketch.geometry[1]!.id,
      { x: 4, y: 4 },
      8,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    sketch = created.sketch;
    const faceLength = sketch.constraints.find((c) => c.type === "length")!.value!;
    const angleId = sketch.constraints.find((c) => c.type === "angle")!.id;
    const edit = createEditDimensionCommand(sketch, angleId, {
      value: Math.PI / 6,
    });
    expect(edit.ok).toBe(true);
    if (!edit.ok) {
      return;
    }
    sketch = edit.command.apply(sketch);
    expect(sketch.constraints.find((c) => c.type === "angle")!.value).toBeCloseTo(
      Math.PI / 6,
      5,
    );
    expect(sketch.constraints.find((c) => c.type === "length")!.value).toBeCloseTo(
      faceLength,
      5,
    );
  });

  it("undo restores fillet", () => {
    let sketch = createEmptySketch();
    sketch = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 100, y: 0 })!.sketch;
    sketch = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 0, y: 100 })!.sketch;
    const before = sketch;
    const cmd = createFilletCommand(sketch, {
      line1Id: sketch.geometry[0]!.id,
      line2Id: sketch.geometry[1]!.id,
      pickPoint: { x: 4, y: 4 },
    });
    expect(cmd.ok).toBe(true);
    if (!cmd.ok) {
      return;
    }
    const history = createCommandHistory();
    const result = executeCommand(history, sketch, cmd.command);
    const undone = undoCommand(result.history, result.sketch);
    expect(undone.sketch.geometry).toEqual(before.geometry);
  });

  it("undo restores chamfer", () => {
    let sketch = createEmptySketch();
    sketch = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 100, y: 0 })!.sketch;
    sketch = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 0, y: 100 })!.sketch;
    const before = sketch;
    const cmd = createChamferCommand(sketch, {
      line1Id: sketch.geometry[0]!.id,
      line2Id: sketch.geometry[1]!.id,
      pickPoint: { x: 3, y: 3 },
    });
    expect(cmd.ok).toBe(true);
    if (!cmd.ok) {
      return;
    }
    const history = createCommandHistory();
    const result = executeCommand(history, sketch, cmd.command);
    const undone = undoCommand(result.history, result.sketch);
    expect(undone.sketch.geometry).toEqual(before.geometry);
  });

  it("fillets a rectangle corner and opens that corner on the feature", () => {
    const add = createAddRectangleCommand({ x: 0, y: 0 }, { x: 100, y: 50 })!;
    const sketch = add.apply(createEmptySketch());
    const rect = parseRectangleFeature(
      sketch.constraints.find((c) => c.type === "rectangle")!,
    );
    expect(rect).not.toBeNull();

    const outcome = applyFilletLines(
      sketch,
      rect!.edges.bottom,
      rect!.edges.right,
      { x: 90, y: 10 },
      8,
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }
    const opened = parseRectangleFeature(
      outcome.sketch.constraints.find((c) => c.type === "rectangle")!,
    );
    expect(opened).not.toBeNull();
    expect(opened!.corners.br).toBeNull();
    expect(opened!.corners.bl).not.toBeNull();
    expect(opened!.corners.tr).not.toBeNull();
    expect(opened!.corners.tl).not.toBeNull();
    expect(outcome.sketch.constraints.some((c) => c.type === "fillet")).toBe(true);
    expect(
      outcome.sketch.constraints.filter((c) => c.type === "horizontal"),
    ).toHaveLength(2);
    expect(
      outcome.sketch.constraints.filter((c) => c.type === "vertical"),
    ).toHaveLength(2);
    expect(outcome.sketch.geometry.some((e) => e.type === "arc")).toBe(true);
    // Filleted corner point removed; other three corners remain.
    expect(
      outcome.sketch.geometry.filter((e) => e.type === "point"),
    ).toHaveLength(3);
  });

  it("chamfers a rectangle corner", () => {
    const add = createAddRectangleCommand({ x: 0, y: 0 }, { x: 80, y: 40 })!;
    const sketch = add.apply(createEmptySketch());
    const rect = parseRectangleFeature(
      sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;
    const outcome = applyChamferLines(
      sketch,
      rect.edges.bottom,
      rect.edges.right,
      { x: 70, y: 8 },
      6,
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }
    const opened = parseRectangleFeature(
      outcome.sketch.constraints.find((c) => c.type === "rectangle")!,
    );
    expect(opened).not.toBeNull();
    expect(opened!.corners.br).toBeNull();
    expect(outcome.sketch.constraints.some((c) => c.type === "chamfer")).toBe(
      true,
    );
  });

  it("rejects an impossible chamfer distance and leaves the sketch unchanged", () => {
    const add = createAddRectangleCommand({ x: 0, y: 0 }, { x: 40, y: 20 })!;
    const sketch = add.apply(createEmptySketch());
    const before = structuredClone(sketch);
    const rect = parseRectangleFeature(
      sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;
    const outcome = applyChamferLines(
      sketch,
      rect.edges.bottom,
      rect.edges.right,
      { x: 35, y: 5 },
      500,
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) {
      return;
    }
    expect(outcome.reason.length).toBeGreaterThan(0);
    expect(sketch).toEqual(before);
    expect(sketch.constraints.some((c) => c.type === "chamfer")).toBe(false);
  });

  it("rejects chamfer of a line with itself without mutating", () => {
    const add = createAddRectangleCommand({ x: 0, y: 0 }, { x: 40, y: 20 })!;
    const sketch = add.apply(createEmptySketch());
    const before = structuredClone(sketch);
    const lineId = sketch.geometry.find((g) => g.type === "line")!.id;
    const outcome = applyChamferLines(sketch, lineId, lineId, { x: 1, y: 1 }, 2);
    expect(outcome.ok).toBe(false);
    expect(sketch).toEqual(before);
  });
});
