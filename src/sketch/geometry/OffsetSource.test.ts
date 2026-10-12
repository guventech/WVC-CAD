import { beforeEach, describe, expect, it } from "vitest";
import { createAddRectangleCommand } from "../commands/CreateRectangleCommand.ts";
import { addCircleToSketch } from "../commands/CreateGeometryCommand.ts";
import { createCommandHistory, executeCommand } from "../commands/Command.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { parseRectangleFeature } from "../model/RectangleFeature.ts";
import { createEmptySketch } from "../model/Sketch.ts";
import { applyFilletLines } from "./FilletChamferOps.ts";
import { resolveOffsetSource } from "./OffsetSource.ts";

describe("OffsetSource", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("resolves a rectangle edge to a closed polyline loop", () => {
    const command = createAddRectangleCommand(
      { x: 0, y: 0 },
      { x: 40, y: 20 },
    )!;
    const { sketch } = executeCommand(
      createCommandHistory(),
      createEmptySketch(),
      command,
    );
    const line = sketch.geometry.find((g) => g.type === "line")!;
    const source = resolveOffsetSource(sketch, line.id);
    expect(source?.kind).toBe("polyline");
    if (source?.kind === "polyline") {
      expect(source.closed).toBe(true);
      expect(source.vertices).toHaveLength(4);
    }
  });

  it("resolves a circle concentrically", () => {
    const created = addCircleToSketch(createEmptySketch(), { x: 10, y: 10 }, 10)!;
    const source = resolveOffsetSource(created.sketch, created.circle.id);
    expect(source).toEqual({
      kind: "circle",
      center: { x: 10, y: 10 },
      radius: 10,
    });
  });

  it("resolves a fillet arc on a closed loop to the densified closed polyline", () => {
    const add = createAddRectangleCommand({ x: 0, y: 0 }, { x: 80, y: 40 })!;
    let sketch = add.apply(createEmptySketch());
    const rect = parseRectangleFeature(
      sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;
    const filleted = applyFilletLines(
      sketch,
      rect.edges.bottom,
      rect.edges.right,
      { x: 70, y: 8 },
      8,
    );
    expect(filleted.ok).toBe(true);
    if (!filleted.ok) {
      return;
    }
    sketch = filleted.sketch;
    const arc = sketch.geometry.find((g) => g.type === "arc");
    expect(arc).toBeDefined();
    const source = resolveOffsetSource(sketch, arc!.id);
    expect(source?.kind).toBe("polyline");
    if (source?.kind === "polyline") {
      expect(source.closed).toBe(true);
      // 3 lines + densified 90° arc (>2 interior samples) → more than 4 verts.
      expect(source.vertices.length).toBeGreaterThan(4);
    }
  });

  it("rebuilds fully filleted (line+arc) profiles as a closed densified offset loop", () => {
    const add = createAddRectangleCommand({ x: 0, y: 0 }, { x: 80, y: 40 })!;
    let sketch = add.apply(createEmptySketch());
    const rect = parseRectangleFeature(
      sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;
    // Fillet every corner so the solid loop is 4 lines + 4 arcs.
    for (const corner of [
      { a: rect.edges.bottom, b: rect.edges.right, pick: { x: 72, y: 8 } },
      { a: rect.edges.right, b: rect.edges.top, pick: { x: 72, y: 32 } },
      { a: rect.edges.top, b: rect.edges.left, pick: { x: 8, y: 32 } },
      { a: rect.edges.left, b: rect.edges.bottom, pick: { x: 8, y: 8 } },
    ] as const) {
      const filleted = applyFilletLines(
        sketch,
        corner.a,
        corner.b,
        corner.pick,
        6,
      );
      expect(filleted.ok).toBe(true);
      if (!filleted.ok) {
        return;
      }
      sketch = filleted.sketch;
    }
    expect(sketch.geometry.filter((g) => g.type === "arc")).toHaveLength(4);

    const remainingBottom = sketch.geometry.find(
      (g) => g.type === "line" && g.id === rect.edges.bottom,
    );
    expect(remainingBottom?.type).toBe("line");
    if (remainingBottom?.type !== "line") {
      return;
    }
    const source = resolveOffsetSource(sketch, remainingBottom.id);
    expect(source?.kind).toBe("polyline");
    if (source?.kind === "polyline") {
      expect(source.closed).toBe(true);
      // 4 straight corners densified away → many vertices, still a single loop.
      expect(source.vertices.length).toBeGreaterThan(8);
    }
  });
});
