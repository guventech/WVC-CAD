import { describe, expect, it } from "vitest";
import { createAddLineCommand } from "../commands/CreateGeometryCommand.ts";
import { createAddRectangleCommand } from "../commands/CreateRectangleCommand.ts";
import { createAddMaintainedConstraintCommand } from "../commands/AddMaintainedConstraintCommand.ts";
import { createEditDimensionCommand } from "../commands/EditDimensionCommand.ts";
import { createEntityId, resetEntityIdCounter } from "../model/EntityId.ts";
import { parseRectangleFeature } from "../model/RectangleFeature.ts";
import { createEmptySketch } from "../model/Sketch.ts";
import { solve } from "../solver/Solver.ts";
import {
  parseSketchJson,
  serializeSketchToJson,
  sketchToDocument,
} from "./SketchSerializer.ts";
import { SKETCH_SCHEMA_VERSION, SKETCH_UNITS } from "./SketchSchema.ts";

describe("SketchSerializer", () => {
  it("round-trips an empty sketch", () => {
    resetEntityIdCounter();
    const sketch = createEmptySketch({ id: "sketch-a", name: "Empty" });
    const json = serializeSketchToJson(sketch, {
      savedAt: "2026-10-05T12:00:00.000Z",
    });
    const parsed = parseSketchJson(json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.sketch).toEqual({
      ...sketch,
      // metadata is document-only; sketch model unchanged besides deep clones
    });
    expect(parsed.document.schemaVersion).toBe(SKETCH_SCHEMA_VERSION);
    expect(parsed.document.units).toBe(SKETCH_UNITS);
    expect(parsed.document.metadata?.savedAt).toBe("2026-10-05T12:00:00.000Z");
  });

  it("round-trips geometry and constraints with equivalent solver status", () => {
    resetEntityIdCounter();
    let sketch = createAddRectangleCommand({ x: 0, y: 0 }, { x: 100, y: 50 })!.apply(
      createEmptySketch(),
    );
    const feature = sketch.constraints
      .map(parseRectangleFeature)
      .find((item) => item !== null)!;

    const width = createAddMaintainedConstraintCommand(sketch, {
      type: "length",
      references: [{ entityId: feature.edges.bottom, role: "entity" }],
    });
    expect(width.ok).toBe(true);
    if (!width.ok) {
      return;
    }
    sketch = width.command.apply(sketch);

    const height = createAddMaintainedConstraintCommand(sketch, {
      type: "length",
      references: [{ entityId: feature.edges.left, role: "entity" }],
    });
    expect(height.ok).toBe(true);
    if (!height.ok) {
      return;
    }
    sketch = height.command.apply(sketch);

    const before = solve(sketch);
    const json = serializeSketchToJson(sketch);
    const parsed = parseSketchJson(json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    expect(parsed.sketch.geometry).toEqual(sketch.geometry);
    expect(parsed.sketch.constraints).toEqual(sketch.constraints);
    expect(parsed.sketch.settings).toEqual(sketch.settings);
    expect(parsed.sketch.units).toBe("mm");

    const after = solve(parsed.sketch);
    expect(after.status).toBe(before.status);
    expect(after.degreesOfFreedom).toBe(before.degreesOfFreedom);
  });

  it("preserves edited dimension values across save/load", () => {
    resetEntityIdCounter();
    let sketch = createAddLineCommand({ x: 0, y: 0 }, { x: 40, y: 0 })!.apply(
      createEmptySketch(),
    );
    const lineId = sketch.geometry[0]!.id;
    const add = createAddMaintainedConstraintCommand(sketch, {
      type: "length",
      references: [{ entityId: lineId, role: "entity" }],
    });
    expect(add.ok).toBe(true);
    if (!add.ok) {
      return;
    }
    sketch = add.command.apply(sketch);
    const lengthId = sketch.constraints.find((c) => c.type === "length")!.id;
    const edit = createEditDimensionCommand(sketch, lengthId, { value: 75 });
    expect(edit.ok).toBe(true);
    if (!edit.ok) {
      return;
    }
    sketch = edit.command.apply(sketch);

    const parsed = parseSketchJson(serializeSketchToJson(sketch));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.sketch.constraints.find((c) => c.id === lengthId)?.value).toBeCloseTo(
      75,
      8,
    );
  });

  it("rejects unsupported units without converting", () => {
    const document = sketchToDocument(createEmptySketch());
    const bad = { ...document, units: "inch" };
    const parsed = parseSketchJson(JSON.stringify(bad));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) {
      return;
    }
    expect(parsed.reason).toMatch(/units/i);
    expect(parsed.reason).toMatch(/never converted/i);
  });

  it("rejects unknown schema versions", () => {
    const document = sketchToDocument(createEmptySketch());
    const bad = { ...document, schemaVersion: 99 };
    const parsed = parseSketchJson(JSON.stringify(bad));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) {
      return;
    }
    expect(parsed.reason).toMatch(/schema version/i);
  });

  it("rejects zero-length lines and non-positive radii on load", () => {
    const document = sketchToDocument(createEmptySketch());
    const zeroLine = {
      ...document,
      geometry: [
        {
          id: "line-bad",
          type: "line",
          start: { x: 1, y: 1 },
          end: { x: 1, y: 1 },
          construction: false,
        },
      ],
    };
    const lineParsed = parseSketchJson(JSON.stringify(zeroLine));
    expect(lineParsed.ok).toBe(false);
    if (!lineParsed.ok) {
      expect(lineParsed.reason).toMatch(/non-zero length/i);
    }

    const zeroCircle = {
      ...document,
      geometry: [
        {
          id: "circle-bad",
          type: "circle",
          center: { x: 0, y: 0 },
          radius: 0,
          construction: false,
        },
      ],
    };
    const circleParsed = parseSketchJson(JSON.stringify(zeroCircle));
    expect(circleParsed.ok).toBe(false);
    if (!circleParsed.ok) {
      expect(circleParsed.reason).toMatch(/radius must be positive/i);
    }
  });

  it("diagnoses loaded geometry without requiring a prior LM settle", () => {
    resetEntityIdCounter();
    // Diagonal line: create does not auto-insert H/V, so DOF stays 4.
    const sketch = createAddLineCommand({ x: 0, y: 0 }, { x: 40, y: 10 })!.apply(
      createEmptySketch(),
    );
    const parsed = parseSketchJson(serializeSketchToJson(sketch));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    const status = solve(parsed.sketch);
    expect(status.status).toBe("under-constrained");
    expect(status.degreesOfFreedom).toBe(4);
  });

  it("syncs entity ids so creates after load do not collide", () => {
    resetEntityIdCounter();
    const sketch = createAddLineCommand({ x: 0, y: 0 }, { x: 10, y: 5 })!.apply(
      createEmptySketch(),
    );
    const parsed = parseSketchJson(serializeSketchToJson(sketch));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    const nextId = createEntityId("line");
    expect(parsed.sketch.geometry.some((entity) => entity.id === nextId)).toBe(
      false,
    );
  });
});
