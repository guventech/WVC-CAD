import { describe, expect, it } from "vitest";
import { choosePointPairDistanceType, classifySmartDistance } from "./SmartDistance.ts";

describe("SmartDistance", () => {
  it("classifies a line pick as length", () => {
    const kind = classifySmartDistance(
      { entityId: "line-1", role: "entity" },
      null,
      null,
      null,
      null,
    );
    expect(kind).toEqual({
      type: "length",
      lineRef: { entityId: "line-1", role: "entity" },
    });
  });

  it("classifies nearly horizontal point pairs as horizontal-distance", () => {
    expect(choosePointPairDistanceType(100, 0.1, Math.hypot(100, 0.1))).toBe(
      "horizontal-distance",
    );
  });

  it("classifies nearly vertical point pairs as vertical-distance", () => {
    expect(choosePointPairDistanceType(0.1, 80, Math.hypot(0.1, 80))).toBe(
      "vertical-distance",
    );
  });

  it("classifies diagonal point pairs as Euclidean distance", () => {
    expect(choosePointPairDistanceType(30, 40, 50)).toBe("distance");
  });

  it("builds a point-pair kind from two worlds", () => {
    const kind = classifySmartDistance(
      null,
      { entityId: "p1", role: "position" },
      { entityId: "p2", role: "position" },
      { x: 0, y: 0 },
      { x: 30, y: 40 },
    );
    expect(kind).toMatchObject({ type: "distance" });
  });
});
