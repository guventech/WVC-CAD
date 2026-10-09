import { beforeEach, describe, expect, it } from "vitest";
import { addLineToSketch, addPointToSketch } from "../commands/CreateGeometryCommand.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { DATUM_AXIS_X_ID, DATUM_AXIS_Y_ID } from "../model/SketchFrame.ts";
import { createEmptySketch } from "../model/Sketch.ts";
import {
  choosePointPairDistanceType,
  classifyDistancePicks,
  classifySmartDistance,
} from "./SmartDistance.ts";

describe("SmartDistance", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("classifies a line pick as length (legacy helper)", () => {
    const kind = classifySmartDistance(
      { entityId: "line-1", role: "entity" },
      null,
      null,
      null,
      null,
    );
    expect(kind).toEqual({
      type: "length",
      lineRef: { entityId: "line-1", role: "entity" },
    });
  });

  it("classifies nearly horizontal point pairs as horizontal-distance", () => {
    expect(choosePointPairDistanceType(100, 0.1, Math.hypot(100, 0.1))).toBe(
      "horizontal-distance",
    );
  });

  it("classifies nearly vertical point pairs as vertical-distance", () => {
    expect(choosePointPairDistanceType(0.1, 80, Math.hypot(0.1, 80))).toBe(
      "vertical-distance",
    );
  });

  it("classifies diagonal point pairs as Euclidean distance", () => {
    expect(choosePointPairDistanceType(30, 40, 50)).toBe("distance");
  });

  it("same line twice → length", () => {
    const created = addLineToSketch(createEmptySketch(), { x: 0, y: 0 }, { x: 40, y: 10 })!;
    const ref = { entityId: created.line.id, role: "entity" as const };
    expect(
      classifyDistancePicks(
        created.sketch,
        { kind: "line", ref },
        { kind: "line", ref },
      ),
    ).toEqual({ type: "length", references: [ref] });
  });

  it("two horizontal lines → vertical-distance", () => {
    let sketch = createEmptySketch();
    const a = addLineToSketch(sketch, { x: 0, y: 10 }, { x: 40, y: 10 })!;
    sketch = a.sketch;
    const b = addLineToSketch(sketch, { x: 0, y: 50 }, { x: 40, y: 50 })!;
    sketch = b.sketch;
    expect(
      classifyDistancePicks(
        sketch,
        { kind: "line", ref: { entityId: a.line.id, role: "entity" } },
        { kind: "line", ref: { entityId: b.line.id, role: "entity" } },
      ),
    ).toEqual({
      type: "vertical-distance",
      references: [
        { entityId: a.line.id, role: "start" },
        { entityId: b.line.id, role: "start" },
      ],
    });
  });

  it("point + X-axis → coordinate-y", () => {
    const created = addPointToSketch(createEmptySketch(), { x: 12, y: 34 });
    expect(
      classifyDistancePicks(
        created.sketch,
        { kind: "point-like", ref: { entityId: created.point.id, role: "position" } },
        { kind: "line", ref: { entityId: DATUM_AXIS_X_ID, role: "entity" } },
      ),
    ).toEqual({
      type: "coordinate-y",
      references: [{ entityId: created.point.id, role: "position" }],
    });
  });

  it("line + Y-axis → coordinate-x", () => {
    const created = addLineToSketch(createEmptySketch(), { x: 25, y: 0 }, { x: 25, y: 40 })!;
    expect(
      classifyDistancePicks(
        created.sketch,
        { kind: "line", ref: { entityId: created.line.id, role: "entity" } },
        { kind: "line", ref: { entityId: DATUM_AXIS_Y_ID, role: "entity" } },
      ),
    ).toEqual({
      type: "coordinate-x",
      references: [{ entityId: created.line.id, role: "start" }],
    });
  });
});
