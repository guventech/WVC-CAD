import { beforeEach, describe, expect, it } from "vitest";
import { createAddRectangleCommand } from "../commands/CreateRectangleCommand.ts";
import { addCircleToSketch, addLineToSketch, addPointToSketch } from "../commands/CreateGeometryCommand.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { parseRectangleFeature } from "../model/RectangleFeature.ts";
import { createEmptySketch } from "../model/Sketch.ts";
import {
  classifySelection,
  evaluateConstraintApplicability,
  selectionConstraintAction,
} from "./ConstraintApplicability.ts";

describe("ConstraintApplicability", () => {
  beforeEach(() => {
    resetEntityIdCounter();
  });

  it("disables most tools when selection is empty", () => {
    const sketch = createEmptySketch();
    const rows = evaluateConstraintApplicability(sketch, []);
    expect(rows.every((row) => row.state === "disabled")).toBe(true);
  });

  it("enables H/V/Length/Fix for a single line and greys Parallel", () => {
    const created = addLineToSketch(
      createEmptySketch(),
      { x: 0, y: 0 },
      { x: 40, y: 0 },
    )!;
    const sketch = created.sketch;
    const id = created.line.id;
    const byId = Object.fromEntries(
      evaluateConstraintApplicability(sketch, [id]).map((row) => [
        row.toolId,
        row,
      ]),
    );

    expect(byId.horizontal?.state).toBe("enabled");
    expect(byId.horizontal?.canApply).toBe(true);
    expect(byId.vertical?.state).toBe("enabled");
    expect(byId["dim-distance"]?.state).toBe("enabled");
    expect(byId["dim-distance"]?.canApply).toBe(true);
    expect(byId.fix?.state).toBe("enabled");
    expect(byId.parallel?.state).toBe("enabled");
    expect(byId.parallel?.canApply).toBe(false);
    expect(byId.parallel?.reason).toMatch(/second line/i);
    expect(byId.concentric?.state).toBe("disabled");
  });

  it("enables Parallel/Perp/Equal/Angle for two lines", () => {
    let sketch = createEmptySketch();
    const a = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 40, y: 0 })!;
    sketch = a.sketch;
    const b = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 0, y: 30 })!;
    sketch = b.sketch;
    const byId = Object.fromEntries(
      evaluateConstraintApplicability(sketch, [a.line.id, b.line.id]).map(
        (row) => [row.toolId, row],
      ),
    );
    expect(byId.parallel?.canApply).toBe(true);
    expect(byId.perpendicular?.canApply).toBe(true);
    expect(byId.equal?.canApply).toBe(true);
    expect(byId["dim-angle"]?.canApply).toBe(true);
  });

  it("enables radius/diameter for a circle", () => {
    const created = addCircleToSketch(
      createEmptySketch(),
      { x: 0, y: 0 },
      20,
    )!;
    const byId = Object.fromEntries(
      evaluateConstraintApplicability(created.sketch, [created.circle.id]).map(
        (row) => [row.toolId, row],
      ),
    );
    expect(byId["dim-radial"]?.canApply).toBe(true);
    expect(byId["dim-distance"]?.state).toBe("disabled");
  });

  it("builds a length request from one selected line via Distance", () => {
    const created = addLineToSketch(
      createEmptySketch(),
      { x: 0, y: 0 },
      { x: 40, y: 10 },
    )!;
    const action = selectionConstraintAction(
      created.sketch,
      [created.line.id],
      "dim-distance",
    );
    expect(action.kind).toBe("apply-maintained");
    if (action.kind === "apply-maintained") {
      expect(action.request.type).toBe("length");
      expect(action.request.references[0]?.entityId).toBe(created.line.id);
    }
  });

  it("continues pick for Parallel with one line", () => {
    const created = addLineToSketch(
      createEmptySketch(),
      { x: 0, y: 0 },
      { x: 40, y: 0 },
    )!;
    const action = selectionConstraintAction(
      created.sketch,
      [created.line.id],
      "parallel",
    );
    expect(action).toEqual({ kind: "continue-pick", tool: "parallel" });
  });

  it("classifies rectangle edges among expanded selection", () => {
    const sketch = createAddRectangleCommand(
      { x: 0, y: 0 },
      { x: 40, y: 20 },
    )!.apply(createEmptySketch());
    const feature = parseRectangleFeature(
      sketch.constraints.find((c) => c.type === "rectangle")!,
    )!;
    const kinds = classifySelection(sketch, [
      feature.edges.bottom,
      feature.edges.left,
      feature.corners.bl!,
    ]);
    expect(kinds.lineCount).toBe(2);
    expect(kinds.pointLikeCount).toBe(1);
  });

  it("enables midpoint for point + line", () => {
    let sketch = createEmptySketch();
    const p = addPointToSketch(sketch, { x: 10, y: 5 });
    sketch = p.sketch;
    const line = addLineToSketch(sketch, { x: 0, y: 0 }, { x: 20, y: 0 })!;
    sketch = line.sketch;
    const byId = Object.fromEntries(
      evaluateConstraintApplicability(sketch, [p.point.id, line.line.id]).map(
        (row) => [row.toolId, row],
      ),
    );
    expect(byId.midpoint?.canApply).toBe(true);
  });
});
