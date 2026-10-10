import { describe, expect, it } from "vitest";
import { distance } from "./GeometryMath.ts";
import { tangentArcFromStart } from "./TangentArcMath.ts";

describe("TangentArcMath", () => {
  it("builds an arc tangent at the start to +X", () => {
    const built = tangentArcFromStart(
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 10, y: 10 },
    );
    expect(built).not.toBeNull();
    expect(distance(built!.center, built!.startPoint)).toBeCloseTo(
      built!.radius,
      5,
    );
    expect(distance(built!.center, built!.endPoint)).toBeCloseTo(
      built!.radius,
      5,
    );
  });
});
