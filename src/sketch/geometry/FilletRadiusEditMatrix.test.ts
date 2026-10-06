import { describe, expect, it, beforeEach } from "vitest";
import { createAddMaintainedConstraintCommand } from "../commands/AddMaintainedConstraintCommand.ts";
import { createAddRectangleCommand } from "../commands/CreateRectangleCommand.ts";
import { createEditDimensionCommand } from "../commands/EditDimensionCommand.ts";
import { listUnsatisfiedConstraints } from "../constraints/ConstraintMaintenance.ts";
import { applyFilletLines } from "./FilletChamferOps.ts";
import { distance } from "./GeometryMath.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { parseRectangleFeature } from "../model/RectangleFeature.ts";
import { createEmptySketch, type Sketch } from "../model/Sketch.ts";

type Workflow = {
  readonly rect: { readonly w: number; readonly h: number };
  readonly offset: { readonly x: number; readonly y: number };
  /** Which rectangle edges get an explicit Length dim (edited to w or h). */
  readonly lengthEdges: readonly ("bottom" | "left" | "top" | "right")[];
  readonly filletCorner: "tr" | "tl" | "br" | "bl";
  readonly initialRadius: number;
  readonly radiusEdits: readonly number[];
};

function editDim(sketch: Sketch, id: string, value: number): Sketch {
  const outcome = createEditDimensionCommand(sketch, id, { value });
  expect(outcome.ok).toBe(true);
  if (!outcome.ok) {
    throw new Error(outcome.reason);
  }
  return outcome.command.apply(sketch);
}

function runWorkflow(label: string, wf: Workflow): void {
  resetEntityIdCounter();
  let sketch = createAddRectangleCommand(
    { x: 0, y: 0 },
    { x: wf.rect.w, y: wf.rect.h },
  )!.apply(createEmptySketch());
  let feature = sketch.constraints
    .map(parseRectangleFeature)
    .find((item) => item !== null)!;

  for (const edgeKey of wf.lengthEdges) {
    const edgeId = feature.edges[edgeKey];
    const add = createAddMaintainedConstraintCommand(sketch, {
      type: "length",
      references: [{ entityId: edgeId, role: "entity" }],
    });
    expect(add.ok, `${label} length add ${edgeKey}`).toBe(true);
    if (!add.ok) {
      return;
    }
    sketch = add.command.apply(sketch);
    const lengthId = sketch.constraints.filter((c) => c.type === "length").at(-1)!.id;
    const target =
      edgeKey === "bottom" || edgeKey === "top" ? wf.rect.w : wf.rect.h;
    const current = sketch.constraints.find((c) => c.id === lengthId)!.value;
    if (current !== undefined && Math.abs(current - target) > 0.01) {
      sketch = editDim(sketch, lengthId, target);
    }
  }

  for (const type of ["coordinate-y", "coordinate-x"] as const) {
    const add = createAddMaintainedConstraintCommand(sketch, {
      type,
      references: [{ entityId: feature.corners.bl!, role: "position" }],
    });
    expect(add.ok, `${label} offset ${type}`).toBe(true);
    if (!add.ok) {
      return;
    }
    sketch = add.command.apply(sketch);
  }
  if (wf.offset.y !== 0 || wf.offset.x !== 0) {
    sketch = editDim(
      sketch,
      sketch.constraints.find((c) => c.type === "coordinate-y")!.id,
      wf.offset.y,
    );
    sketch = editDim(
      sketch,
      sketch.constraints.find((c) => c.type === "coordinate-x")!.id,
      wf.offset.x,
    );
  }

  feature = sketch.constraints
    .map(parseRectangleFeature)
    .find((item) => item !== null)!;
  const pairs: Record<
    Workflow["filletCorner"],
    readonly [string, string, { x: number; y: number }]
  > = {
    tr: [
      feature.edges.top,
      feature.edges.right,
      {
        x: wf.offset.x + wf.rect.w - Math.max(5, wf.initialRadius + 2),
        y: wf.offset.y + wf.rect.h - Math.max(5, wf.initialRadius + 2),
      },
    ],
    tl: [feature.edges.top, feature.edges.left, { x: wf.offset.x + 10, y: wf.offset.y + wf.rect.h - 10 }],
    br: [feature.edges.bottom, feature.edges.right, { x: wf.offset.x + wf.rect.w - 10, y: wf.offset.y + 10 }],
    bl: [feature.edges.bottom, feature.edges.left, { x: wf.offset.x + 10, y: wf.offset.y + 10 }],
  };
  const [a, b, pick] = pairs[wf.filletCorner];
  const filleted = applyFilletLines(sketch, a, b, pick, wf.initialRadius);
  expect(filleted.ok, `${label} fillet`).toBe(true);
  if (!filleted.ok) {
    return;
  }
  sketch = filleted.sketch;

  const radiusId = sketch.constraints.find((c) => c.type === "radius")!.id;
  const lengthTargets = new Map(
    sketch.constraints
      .filter((c) => c.type === "length")
      .map((c) => [c.id, c.value] as const),
  );

  for (const nextR of wf.radiusEdits) {
    const edited = createEditDimensionCommand(sketch, radiusId, { value: nextR });
    expect(edited.ok, `${label} edit R=${nextR}: ${!edited.ok ? edited.reason : "ok"}`).toBe(
      true,
    );
    if (!edited.ok) {
      return;
    }
    sketch = edited.command.apply(sketch);
    const arc = sketch.geometry.find((e) => e.type === "arc");
    expect(arc?.type).toBe("arc");
    if (arc?.type !== "arc") {
      return;
    }
    expect(arc.radius).toBeCloseTo(nextR, 2);
    expect(listUnsatisfiedConstraints(sketch)).toEqual([]);
    for (const length of sketch.constraints.filter((c) => c.type === "length")) {
      const expected = lengthTargets.get(length.id);
      expect(length.value).toBeCloseTo(expected!, 2);
      const line = sketch.geometry.find((e) => e.id === length.references[0]?.entityId);
      if (line?.type === "line" && length.value !== undefined) {
        expect(distance(line.start, line.end)).toBeCloseTo(length.value, 1);
      }
    }
  }
}

describe("Fillet radius edit matrix", () => {
  beforeEach(() => resetEntityIdCounter());

  const cases: readonly [string, Workflow][] = [
    [
      "100×100 offset BL length top+right fillet TR",
      {
        rect: { w: 100, h: 100 },
        offset: { x: 25, y: 10 },
        lengthEdges: ["top", "right"],
        filletCorner: "tr",
        initialRadius: 10,
        radiusEdits: [15, 8, 22],
      },
    ],
    [
      "100×100 offset BL length bottom+left fillet TR (25,10)",
      {
        rect: { w: 100, h: 100 },
        offset: { x: 25, y: 10 },
        lengthEdges: ["bottom", "left"],
        filletCorner: "tr",
        initialRadius: 10,
        radiusEdits: [12, 18],
      },
    ],
    [
      "120×80 offset (30,15) length bottom+left fillet TR",
      {
        rect: { w: 120, h: 80 },
        offset: { x: 30, y: 15 },
        lengthEdges: ["bottom", "left"],
        filletCorner: "tr",
        initialRadius: 8,
        radiusEdits: [14, 6, 18],
      },
    ],
    [
      "100×100 length top+right offset then fillet TR (user order)",
      {
        rect: { w: 100, h: 100 },
        offset: { x: 25, y: 10 },
        lengthEdges: ["bottom", "right"],
        filletCorner: "tr",
        initialRadius: 10,
        radiusEdits: [15],
      },
    ],
  ];

  for (const [label, wf] of cases) {
    it(label, () => runWorkflow(label, wf));
  }
});
