import { beforeEach, describe, expect, it } from "vitest";
import { addPointToSketch } from "./CreateGeometryCommand.ts";
import { removeGeometry } from "./DeleteGeometryCommand.ts";
import { movePointInSketch } from "./MovePointCommand.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { createEmptySketch } from "../model/Sketch.ts";

describe("point geometry commands", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("creates a point at an exact world coordinate", () => {
    const sketch = createEmptySketch();
    const result = addPointToSketch(sketch, { x: 12.5, y: -4 });

    expect(result.point.position).toEqual({ x: 12.5, y: -4 });
    expect(result.sketch.geometry).toHaveLength(1);
    expect(result.sketch.geometry[0]).toEqual(result.point);
    expect(sketch.geometry).toHaveLength(0);
  });

  it("moves a point without changing other entities", () => {
    let sketch = createEmptySketch();
    const first = addPointToSketch(sketch, { x: 0, y: 0 });
    sketch = first.sketch;
    const second = addPointToSketch(sketch, { x: 10, y: 10 });
    sketch = second.sketch;

    sketch = movePointInSketch(sketch, first.point.id, { x: 3, y: 7 });

    expect(sketch.geometry).toEqual([
      { ...first.point, position: { x: 3, y: 7 } },
      second.point,
    ]);
  });

  it("deletes selected points from the sketch", () => {
    let sketch = createEmptySketch();
    const first = addPointToSketch(sketch, { x: 1, y: 1 });
    sketch = first.sketch;
    const second = addPointToSketch(sketch, { x: 2, y: 2 });
    sketch = second.sketch;

    sketch = removeGeometry(sketch, [first.point.id]);

    expect(sketch.geometry).toEqual([second.point]);
  });

  it("preserves coordinates after a move when no further edits occur", () => {
    let sketch = createEmptySketch();
    const created = addPointToSketch(sketch, { x: 40, y: 20 });
    sketch = movePointInSketch(created.sketch, created.point.id, {
      x: 41.25,
      y: -8.5,
    });

    const point = sketch.geometry[0];
    expect(point?.type).toBe("point");
    if (point?.type === "point") {
      expect(point.position).toEqual({ x: 41.25, y: -8.5 });
    }
  });
});
