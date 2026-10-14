import { beforeEach, describe, expect, it } from "vitest";
import { createAddMaintainedConstraintCommand } from "../commands/AddMaintainedConstraintCommand.ts";
import {
  addCircleToSketch,
  addPointToSketch,
} from "../commands/CreateGeometryCommand.ts";
import { createAddRectangleCommand } from "../commands/CreateRectangleCommand.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { parseRectangleFeature } from "../model/RectangleFeature.ts";
import { createEmptySketch, type Sketch } from "../model/Sketch.ts";
import { createCamera, worldToScreen } from "./Camera.ts";
import {
  dimensionLabelAnchor,
  layoutConstraintAnnotations,
} from "./annotationLayout.ts";

function measure(text: string): number {
  return text.length * 6;
}

function boxesOverlap(
  a: { screenX: number; screenY: number; width: number; height: number },
  b: { screenX: number; screenY: number; width: number; height: number },
): boolean {
  const aL = a.screenX - a.width / 2;
  const aR = a.screenX + a.width / 2;
  const aT = a.screenY - a.height / 2;
  const aB = a.screenY + a.height / 2;
  const bL = b.screenX - b.width / 2;
  const bR = b.screenX + b.width / 2;
  const bT = b.screenY - b.height / 2;
  const bB = b.screenY + b.height / 2;
  return !(aR < bL || aL > bR || aB < bT || aT > bB);
}

function addDim(
  sketch: Sketch,
  type: "length" | "radius" | "horizontal-distance" | "vertical-distance" | "coordinate-x" | "coordinate-y",
  references: { entityId: string; role: "entity" | "position" | "start" | "end" }[],
): Sketch {
  const outcome = createAddMaintainedConstraintCommand(sketch, { type, references });
  if (!outcome.ok) {
    throw new Error(outcome.reason);
  }
  return outcome.command.apply(sketch);
}

describe("annotationLayout anti-overlap", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("keeps multiple radius labels from overlapping for nearby circles", () => {
    let sketch = createEmptySketch();
    const c1 = addCircleToSketch(sketch, { x: 0, y: 0 }, 20)!;
    sketch = c1.sketch;
    const c2 = addCircleToSketch(sketch, { x: 5, y: 2 }, 15)!;
    sketch = c2.sketch;
    const c3 = addCircleToSketch(sketch, { x: 2, y: -3 }, 18)!;
    sketch = c3.sketch;
    sketch = addDim(sketch, "radius", [{ entityId: c1.circle.id, role: "entity" }]);
    sketch = addDim(sketch, "radius", [{ entityId: c2.circle.id, role: "entity" }]);
    sketch = addDim(sketch, "radius", [{ entityId: c3.circle.id, role: "entity" }]);

    const camera = createCamera(800, 600, 4);
    const placed = layoutConstraintAnnotations(sketch, camera, measure).filter(
      (item) => item.dimension,
    );
    expect(placed.length).toBe(3);
    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        expect(
          boxesOverlap(placed[i]!, placed[j]!),
          `${placed[i]!.text} overlaps ${placed[j]!.text}`,
        ).toBe(false);
      }
    }
  });

  it("keeps rectangle locate/size dimensions from overlapping", () => {
    let sketch = createAddRectangleCommand({ x: 0, y: 0 }, { x: 140, y: 120 })!.apply(
      createEmptySketch(),
    );
    const rect = parseRectangleFeature(
      sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;
    sketch = addDim(sketch, "coordinate-x", [
      { entityId: rect.corners.bl!, role: "position" },
    ]);
    sketch = addDim(sketch, "coordinate-y", [
      { entityId: rect.corners.bl!, role: "position" },
    ]);
    sketch = addDim(sketch, "length", [{ entityId: rect.edges.bottom, role: "entity" }]);
    sketch = addDim(sketch, "length", [{ entityId: rect.edges.left, role: "entity" }]);

    const camera = createCamera(900, 700, 3);
    const placed = layoutConstraintAnnotations(sketch, camera, measure).filter(
      (item) => item.dimension,
    );
    expect(placed.length).toBeGreaterThanOrEqual(4);
    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        expect(
          boxesOverlap(placed[i]!, placed[j]!),
          `${placed[i]!.text} overlaps ${placed[j]!.text}`,
        ).toBe(false);
      }
    }
  });

  it("deconflicts many labels on a filleted-style dense sketch fixture pattern", () => {
    let sketch = createEmptySketch();
    // Four concentric-ish circles like sketch (7) radii + H/V locate dims.
    const circles = [
      addCircleToSketch(sketch, { x: 0, y: 60 }, 28)!,
    ];
    sketch = circles[0]!.sketch;
    for (const [cx, cy, r] of [
      [5, 62, 20],
      [-3, 58, 24],
      [2, 65, 25],
    ] as const) {
      const created = addCircleToSketch(sketch, { x: cx, y: cy }, r)!;
      sketch = created.sketch;
      circles.push(created);
    }
    for (const created of circles) {
      sketch = addDim(sketch, "radius", [
        { entityId: created.circle.id, role: "entity" },
      ]);
    }
    const p = addPointToSketch(sketch, { x: -80, y: 60 });
    sketch = p.sketch;
    const q = addPointToSketch(sketch, { x: 60, y: 60 });
    sketch = q.sketch;
    sketch = addDim(sketch, "coordinate-x", [
      { entityId: p.point.id, role: "position" },
    ]);
    sketch = addDim(sketch, "coordinate-y", [
      { entityId: p.point.id, role: "position" },
    ]);
    sketch = addDim(sketch, "horizontal-distance", [
      { entityId: p.point.id, role: "position" },
      { entityId: q.point.id, role: "position" },
    ]);
    const top = addPointToSketch(sketch, { x: -80, y: 180 });
    sketch = top.sketch;
    sketch = addDim(sketch, "vertical-distance", [
      { entityId: p.point.id, role: "position" },
      { entityId: top.point.id, role: "position" },
    ]);

    const camera = createCamera(1000, 800, 3);
    const placed = layoutConstraintAnnotations(sketch, camera, measure).filter(
      (item) => item.dimension,
    );
    expect(placed.length).toBeGreaterThanOrEqual(8);
    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        expect(
          boxesOverlap(placed[i]!, placed[j]!),
          `${placed[i]!.constraintId}/${placed[i]!.text} overlaps ${placed[j]!.constraintId}/${placed[j]!.text}`,
        ).toBe(false);
      }
    }
  });

  it("pins a dimension label when annotation.labelOffset is set", () => {
    let sketch = createAddRectangleCommand({ x: 0, y: 0 }, { x: 80, y: 40 })!.apply(
      createEmptySketch(),
    );
    const rect = parseRectangleFeature(
      sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;
    sketch = addDim(sketch, "length", [
      { entityId: rect.edges.bottom, role: "entity" },
    ]);
    const length = sketch.constraints.find((c) => c.type === "length")!;
    const anchor = dimensionLabelAnchor(sketch, length.id)!;
    sketch = {
      ...sketch,
      constraints: sketch.constraints.map((constraint) =>
        constraint.id === length.id
          ? {
              ...constraint,
              annotation: { labelOffset: { x: 12, y: -7 } },
            }
          : constraint,
      ),
    };
    const camera = createCamera(800, 600, 4);
    const placed = layoutConstraintAnnotations(sketch, camera, measure).find(
      (item) => item.constraintId === length.id,
    )!;
    // Horizontal length → axis-constrain drops X; leaders/label share ±Y.
    const expected = worldToScreen(
      { x: anchor.x, y: anchor.y - 7 },
      camera,
    );
    expect(placed.screenX).toBeCloseTo(expected.x, 6);
    expect(placed.screenY).toBeCloseTo(expected.y, 6);
  });
});
