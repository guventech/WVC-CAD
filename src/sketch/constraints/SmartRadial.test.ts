import { describe, expect, it } from "vitest";
import {
  addArcToSketch,
  addCircleToSketch,
} from "../commands/CreateGeometryCommand.ts";
import { createEmptySketch } from "../model/Sketch.ts";
import { classifyRadialPick } from "./SmartRadial.ts";

describe("SmartRadial", () => {
  it("maps arcs to radius even when diameter is preferred", () => {
    const result = addArcToSketch(
      createEmptySketch(),
      { x: 0, y: 0 },
      20,
      0,
      Math.PI / 2,
    )!;
    expect(classifyRadialPick(result.sketch, result.arc.id, false)?.type).toBe(
      "radius",
    );
    expect(classifyRadialPick(result.sketch, result.arc.id, true)?.type).toBe(
      "radius",
    );
  });

  it("maps circles to diameter by default and radius with preferRadius", () => {
    const result = addCircleToSketch(createEmptySketch(), { x: 0, y: 0 }, 15)!;
    expect(
      classifyRadialPick(result.sketch, result.circle.id, false)?.type,
    ).toBe("diameter");
    expect(
      classifyRadialPick(result.sketch, result.circle.id, true)?.type,
    ).toBe("radius");
  });
});
