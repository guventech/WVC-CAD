import { describe, expect, it } from "vitest";
import { createAddRectangleCommand } from "../commands/CreateRectangleCommand.ts";
import { resetEntityIdCounter } from "../model/EntityId.ts";
import { parseRectangleFeature } from "../model/RectangleFeature.ts";
import { createEmptySketch } from "../model/Sketch.ts";
import { createResidualContext, buildResidualVector } from "./Residuals.ts";

/**
 * Stored-handle coincident residuals must stay distinct from normalized corner
 * points so rectangle edge length cannot drift away from corner geometry.
 */
describe("coincident stored-handle dual path", () => {
  it("keeps rectangle topology residuals present alongside edge coincidents", () => {
    resetEntityIdCounter();
    const sketch = createAddRectangleCommand({ x: 0, y: 0 }, { x: 40, y: 20 })!.apply(
      createEmptySketch(),
    );
    const feature = sketch.constraints
      .map(parseRectangleFeature)
      .find((item) => item !== null);
    expect(feature).not.toBeNull();

    const context = createResidualContext(sketch);
    const equations = buildResidualVector(sketch, context);
    const rectangleEqs = equations.filter((eq) =>
      sketch.constraints.some(
        (c) => c.id === eq.constraintId && c.type === "rectangle",
      ),
    );
    const coincidentEqs = equations.filter((eq) =>
      sketch.constraints.some(
        (c) => c.id === eq.constraintId && c.type === "coincident",
      ),
    );

    expect(rectangleEqs.length).toBeGreaterThan(0);
    expect(coincidentEqs.length).toBeGreaterThan(0);
  });
});
