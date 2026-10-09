import { beforeEach, describe, expect, it } from "vitest";
import {
  createCommandHistory,
  executeCommand,
} from "../commands/Command.ts";
import { createAddMaintainedConstraintCommand } from "../commands/AddMaintainedConstraintCommand.ts";
import { createFilletCommand } from "../commands/FilletChamferCommand.ts";
import { createAddRectangleCommand } from "../commands/CreateRectangleCommand.ts";
import { createCoincidentConstraint } from "../constraints/ConstraintFactory.ts";
import {
  listUnsatisfiedConstraints,
  maintainConstraints,
} from "../constraints/ConstraintMaintenance.ts";
import { applyFilletLines } from "./FilletChamferOps.ts";
import { distance } from "./GeometryMath.ts";
import { createEntityId, resetEntityIdCounter } from "../model/EntityId.ts";
import { parseRectangleFeature } from "../model/RectangleFeature.ts";
import {
  DATUM_AXIS_X_ID,
  DATUM_ORIGIN_ID,
} from "../model/SketchFrame.ts";
import { createEmptySketch, type Sketch } from "../model/Sketch.ts";
import { parseSketchJson } from "../serialization/SketchSerializer.ts";
import type { SnapCandidate } from "../selection/SnapTypes.ts";
import { solve } from "../solver/Solver.ts";
import fixtureJson from "../../tests/fixtures/fillet-moves-after-create.sketch.json?raw";

function lineOf(sketch: Sketch, id: string) {
  const entity = sketch.geometry.find((e) => e.id === id);
  expect(entity?.type).toBe("line");
  if (entity?.type !== "line") {
    throw new Error("expected line");
  }
  return entity;
}

function pointOf(sketch: Sketch, id: string) {
  const entity = sketch.geometry.find((e) => e.id === id);
  expect(entity?.type).toBe("point");
  if (entity?.type !== "point") {
    throw new Error("expected point");
  }
  return entity;
}

function originSnap(): SnapCandidate {
  return {
    type: "origin",
    point: { x: 0, y: 0 },
    sourceEntityId: DATUM_ORIGIN_ID,
    priority: 0,
    label: "Origin",
  };
}

function assertPoseOnAxes(
  sketch: Sketch,
  rect: NonNullable<ReturnType<typeof parseRectangleFeature>>,
): void {
  const left = lineOf(sketch, rect.edges.left);
  const bottom = lineOf(sketch, rect.edges.bottom);
  expect(Math.abs(left.start.x)).toBeLessThan(1e-3);
  expect(Math.abs(left.end.x)).toBeLessThan(1e-3);
  expect(Math.abs(bottom.start.y)).toBeLessThan(1e-3);
  expect(Math.abs(bottom.end.y)).toBeLessThan(1e-3);
}

function assertBlTopology(
  sketch: Sketch,
  rect: NonNullable<ReturnType<typeof parseRectangleFeature>>,
): void {
  expect(rect.corners.bl).not.toBeNull();
  if (rect.corners.bl === null) {
    return;
  }
  const bl = pointOf(sketch, rect.corners.bl);
  const bottom = lineOf(sketch, rect.edges.bottom);
  const left = lineOf(sketch, rect.edges.left);
  expect(distance(bl.position, bottom.start)).toBeLessThan(1e-3);
  expect(distance(bl.position, left.end)).toBeLessThan(1e-3);
}

function constraintTypesOnEdge(sketch: Sketch, edgeId: string): string[] {
  return sketch.constraints
    .filter((c) => c.references.some((r) => r.entityId === edgeId))
    .map((c) => c.type);
}

/**
 * Recreate sketch-13 from scratch: 180×160 on origin/X, length dims, TL+TR fillets.
 * Primary acceptance is the live path — not healing the saved fixture.
 */
describe("fillet-after-create drift (sketch-13 recreate)", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  /**
   * Fragile locate matching sketch-13 saves: corner-point origin/X coincidents
   * only — no edge coordinate-x/y. Size via driving edge lengths.
   */
  function buildSketch13FragileLocate(): {
    sketch: Sketch;
    rect: NonNullable<ReturnType<typeof parseRectangleFeature>>;
  } {
    let sketch = createAddRectangleCommand(
      { x: 0, y: 0 },
      { x: 180, y: 160 },
    )!.apply(createEmptySketch());
    const rect = parseRectangleFeature(
      sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;
    expect(rect.corners.bl).not.toBeNull();
    expect(rect.corners.br).not.toBeNull();

    sketch = {
      ...sketch,
      constraints: [
        ...sketch.constraints,
        createCoincidentConstraint(
          createEntityId("constraint"),
          { entityId: rect.corners.bl!, role: "position" },
          { entityId: DATUM_ORIGIN_ID, role: "position" },
        ),
        createCoincidentConstraint(
          createEntityId("constraint"),
          { entityId: rect.corners.br!, role: "position" },
          { entityId: DATUM_AXIS_X_ID, role: "entity" },
        ),
      ],
    };
    sketch = maintainConstraints(sketch).sketch;

    for (const [edgeId, value] of [
      [rect.edges.top, 180],
      [rect.edges.right, 160],
    ] as const) {
      const outcome = createAddMaintainedConstraintCommand(sketch, {
        type: "length",
        references: [{ entityId: edgeId, role: "entity" }],
        value,
      });
      expect(outcome.ok, outcome.ok ? "" : outcome.reason).toBe(true);
      if (!outcome.ok) {
        throw new Error(outcome.reason);
      }
      sketch = outcome.command.apply(sketch);
    }

    // Match sketch-13: no edge coordinate locate.
    expect(
      sketch.constraints.some((c) => c.type.startsWith("coordinate")),
    ).toBe(false);
    return { sketch, rect };
  }

  /** Durable path: origin snap emits edge coordinates (ADR-051). */
  function buildSketch13DurableLocate(): {
    sketch: Sketch;
    rect: NonNullable<ReturnType<typeof parseRectangleFeature>>;
  } {
    const add = createAddRectangleCommand(
      { x: 0, y: 0 },
      { x: 180, y: 160 },
      { cornerASnap: originSnap() },
    )!;
    let sketch = add.apply(createEmptySketch());
    const rect = parseRectangleFeature(
      sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;

    for (const [edgeId, value] of [
      [rect.edges.top, 180],
      [rect.edges.right, 160],
    ] as const) {
      const outcome = createAddMaintainedConstraintCommand(sketch, {
        type: "length",
        references: [{ entityId: edgeId, role: "entity" }],
        value,
      });
      expect(outcome.ok, outcome.ok ? "" : outcome.reason).toBe(true);
      if (!outcome.ok) {
        throw new Error(outcome.reason);
      }
      sketch = outcome.command.apply(sketch);
    }
    return { sketch, rect };
  }

  it("pre-fillet fragile locate: on axes, BL glued, sized 180×160", () => {
    const { sketch, rect } = buildSketch13FragileLocate();
    expect(listUnsatisfiedConstraints(sketch)).toEqual([]);
    assertPoseOnAxes(sketch, rect);
    assertBlTopology(sketch, rect);
    const left = lineOf(sketch, rect.edges.left);
    const right = lineOf(sketch, rect.edges.right);
    const bottom = lineOf(sketch, rect.edges.bottom);
    const top = lineOf(sketch, rect.edges.top);
    expect(Math.abs(right.start.x - left.start.x)).toBeCloseTo(180, 3);
    expect(Math.abs(top.start.y - bottom.start.y)).toBeCloseTo(160, 3);
    expect(solve(sketch).degreesOfFreedom).toBe(0);
  });

  it("fragile corner-point locate + lengths + TL/TR: must not drift", () => {
    let { sketch, rect } = buildSketch13FragileLocate();

    const tl = applyFilletLines(
      sketch,
      rect.edges.left,
      rect.edges.top,
      { x: 35, y: 125 },
      35,
    );
    expect(tl.ok, tl.ok ? "" : tl.reason).toBe(true);
    if (!tl.ok) {
      return;
    }
    sketch = tl.sketch;
    rect = parseRectangleFeature(
      sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;

    expect(listUnsatisfiedConstraints(sketch)).toEqual([]);
    assertPoseOnAxes(sketch, rect);
    assertBlTopology(sketch, rect);
    expect(constraintTypesOnEdge(sketch, rect.edges.top)).not.toContain(
      "length",
    );

    const tr = applyFilletLines(
      sketch,
      rect.edges.top,
      rect.edges.right,
      { x: 150, y: 130 },
      27,
    );
    expect(tr.ok, tr.ok ? "" : tr.reason).toBe(true);
    if (!tr.ok) {
      return;
    }
    sketch = tr.sketch;
    rect = parseRectangleFeature(
      sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;

    expect(listUnsatisfiedConstraints(sketch)).toEqual([]);
    assertPoseOnAxes(sketch, rect);
    assertBlTopology(sketch, rect);
    expect(constraintTypesOnEdge(sketch, rect.edges.top)).not.toContain(
      "length",
    );
    expect(constraintTypesOnEdge(sketch, rect.edges.right)).not.toContain(
      "length",
    );

    const left = lineOf(sketch, rect.edges.left);
    const right = lineOf(sketch, rect.edges.right);
    expect(Math.abs(right.start.x - left.start.x)).toBeCloseTo(180, 2);
    expect(Math.abs(left.start.x)).toBeLessThan(1);
    expect(Math.abs(lineOf(sketch, rect.edges.bottom).start.y)).toBeLessThan(1);
  });

  it("UI fillet command (radius from pick) TL/TR: no drift", () => {
    let { sketch, rect } = buildSketch13FragileLocate();
    for (const request of [
      {
        line1Id: rect.edges.left,
        line2Id: rect.edges.top,
        pickPoint: { x: 35, y: 125 },
      },
      {
        line1Id: rect.edges.top,
        line2Id: rect.edges.right,
        pickPoint: { x: 153, y: 133 },
      },
    ] as const) {
      const outcome = createFilletCommand(sketch, request);
      expect(outcome.ok, outcome.ok ? "" : outcome.reason).toBe(true);
      if (!outcome.ok) {
        return;
      }
      sketch = executeCommand(
        createCommandHistory(),
        sketch,
        outcome.command,
      ).sketch;
    }
    rect = parseRectangleFeature(
      sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;
    expect(listUnsatisfiedConstraints(sketch)).toEqual([]);
    assertPoseOnAxes(sketch, rect);
    assertBlTopology(sketch, rect);
    expect(constraintTypesOnEdge(sketch, rect.edges.top)).not.toContain(
      "length",
    );
    expect(constraintTypesOnEdge(sketch, rect.edges.right)).not.toContain(
      "length",
    );
  });

  it("durable origin-snap path: TL/TR fillets keep pose", () => {
    let { sketch, rect } = buildSketch13DurableLocate();
    expect(
      sketch.constraints.some((c) => c.type === "coordinate-x"),
    ).toBe(true);
    expect(
      sketch.constraints.some((c) => c.type === "coordinate-y"),
    ).toBe(true);

    for (const corner of [
      {
        a: rect.edges.left,
        b: rect.edges.top,
        pick: { x: 35, y: 125 },
        r: 35,
      },
      {
        a: rect.edges.top,
        b: rect.edges.right,
        pick: { x: 150, y: 130 },
        r: 27,
      },
    ] as const) {
      const fillet = applyFilletLines(
        sketch,
        corner.a,
        corner.b,
        corner.pick,
        corner.r,
      );
      expect(fillet.ok, fillet.ok ? "" : fillet.reason).toBe(true);
      if (!fillet.ok) {
        return;
      }
      sketch = fillet.sketch;
    }
    rect = parseRectangleFeature(
      sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;
    expect(listUnsatisfiedConstraints(sketch)).toEqual([]);
    assertPoseOnAxes(sketch, rect);
    assertBlTopology(sketch, rect);
  });

  it("documentary: saved sketch-13 fixture is drifted (not the success path)", () => {
    const parsed = parseSketchJson(fixtureJson);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    const rect = parseRectangleFeature(
      parsed.sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;
    const left = lineOf(parsed.sketch, rect.edges.left);
    const bottom = lineOf(parsed.sketch, rect.edges.bottom);
    // Historical broken save: edges off axes while lengths remain segment type.
    expect(Math.abs(left.start.x)).toBeGreaterThan(1);
    expect(Math.abs(bottom.start.y)).toBeGreaterThan(1);
    expect(
      parsed.sketch.constraints.some(
        (c) =>
          c.type === "length" &&
          c.references[0]?.entityId === rect.edges.top,
      ),
    ).toBe(true);
  });
});
