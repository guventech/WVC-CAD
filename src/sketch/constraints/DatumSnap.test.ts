import { beforeEach, describe, expect, it } from "vitest";
import { createAddCircleCommand } from "../commands/CreateGeometryCommand.ts";
import { createAddRectangleCommand } from "../commands/CreateRectangleCommand.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { parseRectangleFeature } from "../model/RectangleFeature.ts";
import {
  DATUM_AXIS_X_ID,
  DATUM_AXIS_Y_ID,
  DATUM_ORIGIN_ID,
} from "../model/SketchFrame.ts";
import { createEmptySketch } from "../model/Sketch.ts";
import type { SnapCandidate } from "../selection/SnapTypes.ts";
import { datumSnapFromCandidate } from "./DatumSnap.ts";

function originSnap(): SnapCandidate {
  return {
    type: "origin",
    point: { x: 0, y: 0 },
    sourceEntityId: DATUM_ORIGIN_ID,
    priority: 0,
    label: "Origin",
  };
}

function axisSnap(
  axisId: typeof DATUM_AXIS_X_ID | typeof DATUM_AXIS_Y_ID,
  point: { x: number; y: number },
): SnapCandidate {
  return {
    type: "axis",
    point,
    sourceEntityId: axisId,
    priority: 1,
    label: axisId,
  };
}

describe("DatumSnap auto-constraints (ADR-050)", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("reads origin and axis binds from snap candidates", () => {
    expect(datumSnapFromCandidate(originSnap())).toEqual({
      kind: "origin",
      originId: DATUM_ORIGIN_ID,
    });
    expect(datumSnapFromCandidate(axisSnap(DATUM_AXIS_Y_ID, { x: 0, y: 20 }))).toEqual({
      kind: "axis",
      axisId: DATUM_AXIS_Y_ID,
    });
    expect(datumSnapFromCandidate(null)).toBeNull();
  });

  it("rectangle from origin gets coincident to origin", () => {
    const command = createAddRectangleCommand(
      { x: 0, y: 0 },
      { x: 40, y: 30 },
      { cornerASnap: originSnap() },
    )!;
    const sketch = command.apply(createEmptySketch());
    const feature = sketch.constraints
      .map(parseRectangleFeature)
      .find((item) => item !== null)!;
    const originCoincident = sketch.constraints.find(
      (c) =>
        c.type === "coincident" &&
        c.references.some((r) => r.entityId === DATUM_ORIGIN_ID) &&
        c.references.some((r) => r.entityId === feature.corners.bl),
    );
    expect(originCoincident).toBeDefined();
  });

  it("rectangle from Y-axis to X-axis pins left and bottom to the axes", () => {
    const command = createAddRectangleCommand(
      { x: 0, y: 50 },
      { x: 80, y: 0 },
      {
        cornerASnap: axisSnap(DATUM_AXIS_Y_ID, { x: 0, y: 50 }),
        cornerBSnap: axisSnap(DATUM_AXIS_X_ID, { x: 80, y: 0 }),
      },
    )!;
    const sketch = command.apply(createEmptySketch());
    const feature = sketch.constraints
      .map(parseRectangleFeature)
      .find((item) => item !== null)!;

    const onY = sketch.constraints.filter(
      (c) =>
        c.type === "coincident" &&
        c.references.some((r) => r.entityId === DATUM_AXIS_Y_ID),
    );
    const onXOrOrigin = sketch.constraints.filter(
      (c) =>
        c.type === "coincident" &&
        c.references.some(
          (r) =>
            r.entityId === DATUM_AXIS_X_ID || r.entityId === DATUM_ORIGIN_ID,
        ),
    );
    expect(onY.length).toBeGreaterThanOrEqual(1);
    expect(onXOrOrigin.length).toBeGreaterThanOrEqual(1);
    // BL at origin should be origin-coincident (stronger than axis-only).
    expect(
      sketch.constraints.some(
        (c) =>
          c.type === "coincident" &&
          c.references.some((r) => r.entityId === DATUM_ORIGIN_ID) &&
          c.references.some((r) => r.entityId === feature.corners.bl),
      ),
    ).toBe(true);
    // Durable edge locate (survives fillets): coordinate-x on left, coordinate-y on bottom.
    expect(
      sketch.constraints.some(
        (c) =>
          c.type === "coordinate-x" &&
          c.value === 0 &&
          c.references[0]?.entityId === feature.edges.left,
      ),
    ).toBe(true);
    expect(
      sketch.constraints.some(
        (c) =>
          c.type === "coordinate-y" &&
          c.value === 0 &&
          c.references[0]?.entityId === feature.edges.bottom,
      ),
    ).toBe(true);
  });

  it("circle center on origin gets coincident to origin", () => {
    const command = createAddCircleCommand(
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { centerSnap: originSnap() },
    )!;
    const sketch = command.apply(createEmptySketch());
    const circle = sketch.geometry.find((g) => g.type === "circle")!;
    expect(
      sketch.constraints.some(
        (c) =>
          c.type === "coincident" &&
          c.references.some((r) => r.entityId === circle.id && r.role === "center") &&
          c.references.some((r) => r.entityId === DATUM_ORIGIN_ID),
      ),
    ).toBe(true);
  });
});
