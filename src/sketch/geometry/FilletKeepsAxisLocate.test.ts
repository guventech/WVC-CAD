import { beforeEach, describe, expect, it } from "vitest";
import {
  createCommandHistory,
  executeCommand,
} from "../commands/Command.ts";
import { createAddMaintainedConstraintCommand } from "../commands/AddMaintainedConstraintCommand.ts";
import { createFilletCommand } from "../commands/FilletChamferCommand.ts";
import { createAddRectangleCommand } from "../commands/CreateRectangleCommand.ts";
import {
  listUnsatisfiedConstraints,
  settleLoadedSketch,
} from "../constraints/ConstraintMaintenance.ts";
import { applyFilletLines } from "./FilletChamferOps.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { parseRectangleFeature } from "../model/RectangleFeature.ts";
import {
  DATUM_AXIS_X_ID,
  DATUM_AXIS_Y_ID,
  DATUM_ORIGIN_ID,
} from "../model/SketchFrame.ts";
import { createEmptySketch, type Sketch } from "../model/Sketch.ts";
import { parseSketchJson } from "../serialization/SketchSerializer.ts";
import type { SnapCandidate } from "../selection/SnapTypes.ts";
import { solve } from "../solver/Solver.ts";
import fixtureJson from "../../tests/fixtures/fillet-broke-axis-locate.sketch.json?raw";

function axisOnLine(
  sketch: Sketch,
  lineId: string,
  axis: "x" | "y",
  expected: number,
): void {
  const line = sketch.geometry.find((e) => e.id === lineId);
  expect(line?.type).toBe("line");
  if (line?.type !== "line") {
    return;
  }
  if (axis === "x") {
    expect(Math.abs(line.start.x - expected)).toBeLessThan(1e-3);
    expect(Math.abs(line.end.x - expected)).toBeLessThan(1e-3);
  } else {
    expect(Math.abs(line.start.y - expected)).toBeLessThan(1e-3);
    expect(Math.abs(line.end.y - expected)).toBeLessThan(1e-3);
  }
}

/**
 * sketch-1 (11): Y→X rectangle, 100×100 lengths, fillet TL R≈20.
 * Axis-locked sides must not float; outer size stays; radii carve corners.
 * The saved fixture documents the historical floated state and must heal on load.
 */
describe("fillet keeps axis locate on rectangle", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

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

  function buildSizedAxisRectangle(): {
    sketch: Sketch;
    rect: NonNullable<ReturnType<typeof parseRectangleFeature>>;
  } {
    const add = createAddRectangleCommand(
      { x: 0, y: 100 },
      { x: 100, y: 0 },
      {
        cornerASnap: axisSnap(DATUM_AXIS_Y_ID, { x: 0, y: 100 }),
        cornerBSnap: axisSnap(DATUM_AXIS_X_ID, { x: 100, y: 0 }),
      },
    )!;
    let sketch = add.apply(createEmptySketch());
    const rect = parseRectangleFeature(
      sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;

    for (const [edgeId, value] of [
      [rect.edges.top, 100],
      [rect.edges.right, 100],
    ] as const) {
      const outcome = createAddMaintainedConstraintCommand(sketch, {
        type: "length",
        references: [{ entityId: edgeId, role: "entity" }],
        value,
      });
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) {
        throw new Error(outcome.reason);
      }
      sketch = outcome.command.apply(sketch);
    }
    return { sketch, rect };
  }

  it("UI fillet command: left stays on Y, bottom on X, outer size kept", () => {
    const { sketch: sized, rect } = buildSizedAxisRectangle();
    expect(solve(sized).degreesOfFreedom).toBe(0);

    const outcome = createFilletCommand(sized, {
      line1Id: rect.edges.left,
      line2Id: rect.edges.top,
      pickPoint: { x: 20, y: 80 },
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) {
      return;
    }
    const result = executeCommand(
      createCommandHistory(),
      sized,
      outcome.command,
    );
    const sketch = result.sketch;

    expect(listUnsatisfiedConstraints(sketch)).toEqual([]);
    axisOnLine(sketch, rect.edges.left, "x", 0);
    axisOnLine(sketch, rect.edges.bottom, "y", 0);

    const width = sketch.constraints.find(
      (c) =>
        c.type === "horizontal-distance" &&
        c.references.some((r) => r.entityId === rect.edges.left) &&
        c.references.some((r) => r.entityId === rect.edges.right),
    );
    expect(width?.value).toBeCloseTo(100, 5);

    const left = sketch.geometry.find((e) => e.id === rect.edges.left);
    const right = sketch.geometry.find((e) => e.id === rect.edges.right);
    expect(left?.type).toBe("line");
    expect(right?.type).toBe("line");
    if (left?.type === "line" && right?.type === "line") {
      expect(Math.abs(right.start.x - left.start.x)).toBeCloseTo(100, 3);
    }

    // Axis locate survives as coordinate-x on the left edge (not only Y coincident).
    expect(
      sketch.constraints.some(
        (c) =>
          c.type === "coordinate-x" &&
          c.value === 0 &&
          c.references[0]?.entityId === rect.edges.left,
      ),
    ).toBe(true);

    // Segment length must not remain on the trimmed top edge.
    expect(
      sketch.constraints.some(
        (c) =>
          c.type === "length" &&
          c.references[0]?.entityId === rect.edges.top,
      ),
    ).toBe(false);
  });

  it("two top fillets keep both axis locks", () => {
    const { sketch: sized, rect } = buildSizedAxisRectangle();
    let sketch = sized;

    const tl = applyFilletLines(
      sketch,
      rect.edges.top,
      rect.edges.left,
      { x: 15, y: 85 },
      20,
    );
    expect(tl.ok).toBe(true);
    if (!tl.ok) {
      return;
    }
    sketch = tl.sketch;

    const tr = applyFilletLines(
      sketch,
      rect.edges.top,
      rect.edges.right,
      { x: 85, y: 85 },
      15,
    );
    expect(tr.ok).toBe(true);
    if (!tr.ok) {
      return;
    }
    sketch = tr.sketch;

    expect(listUnsatisfiedConstraints(sketch)).toEqual([]);
    axisOnLine(sketch, rect.edges.left, "x", 0);
    axisOnLine(sketch, rect.edges.bottom, "y", 0);
  });

  it("origin-anchored 100×100 + TL fillet stays on axes", () => {
    const add = createAddRectangleCommand(
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      { cornerASnap: originSnap() },
    )!;
    let sketch = add.apply(createEmptySketch());
    const rect = parseRectangleFeature(
      sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;

    for (const [edgeId, value] of [
      [rect.edges.top, 100],
      [rect.edges.right, 100],
    ] as const) {
      const outcome = createAddMaintainedConstraintCommand(sketch, {
        type: "length",
        references: [{ entityId: edgeId, role: "entity" }],
        value,
      });
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) {
        return;
      }
      sketch = outcome.command.apply(sketch);
    }

    const fillet = applyFilletLines(
      sketch,
      rect.edges.left,
      rect.edges.top,
      { x: 20, y: 80 },
      20,
    );
    expect(fillet.ok).toBe(true);
    if (!fillet.ok) {
      return;
    }
    expect(listUnsatisfiedConstraints(fillet.sketch)).toEqual([]);
    axisOnLine(fillet.sketch, rect.edges.left, "x", 0);
    axisOnLine(fillet.sketch, rect.edges.bottom, "y", 0);
  });

  it("documentary: floated sketch-11 fixture stays a broken save (no invent-on-load)", () => {
    const parsed = parseSketchJson(fixtureJson);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    const rect = parseRectangleFeature(
      parsed.sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;
    const brokenLeft = parsed.sketch.geometry.find(
      (e) => e.id === rect.edges.left,
    );
    expect(brokenLeft?.type).toBe("line");
    if (brokenLeft?.type !== "line") {
      return;
    }
    expect(Math.abs(brokenLeft.start.x)).toBeGreaterThan(1);

    // Settle may promote lengths but must not invent missing axis locate.
    const settled = settleLoadedSketch(parsed.sketch);
    expect(
      settled.constraints.some((c) => c.type === "horizontal-distance"),
    ).toBe(true);
    // Success path is recreate + fillet (above), not healing this file.
  });
});
