import { describe, expect, it } from "vitest";
import { arcMidAngle, normalizeAngle } from "../geometry/GeometryMath.ts";
import type { ArcGeometry, CircleGeometry } from "../model/Geometry.ts";
import { radialDimensionAngle } from "./radialDimensionAngle.ts";

function arc(
  id: string,
  startAngle: number,
  endAngle: number,
): ArcGeometry {
  return {
    id,
    type: "arc",
    center: { x: 0, y: 0 },
    radius: 10,
    startAngle,
    endAngle,
    construction: false,
  };
}

describe("radialDimensionAngle", () => {
  it("aims each fillet-style corner arc at its own sweep midpoint", () => {
    // Quarter fillets around a rectangle: TR, TL, BL, BR in CCW storage.
    const corners = [
      arc("tr", 0, Math.PI / 2),
      arc("tl", Math.PI / 2, Math.PI),
      arc("bl", Math.PI, (3 * Math.PI) / 2),
      arc("br", (3 * Math.PI) / 2, Math.PI * 2),
    ];

    const angles = corners.map((entity) =>
      radialDimensionAngle(entity, `radius-${entity.id}`),
    );

    expect(normalizeAngle(angles[0]!)).toBeCloseTo(Math.PI / 4, 5);
    expect(normalizeAngle(angles[1]!)).toBeCloseTo((3 * Math.PI) / 4, 5);
    expect(normalizeAngle(angles[2]!)).toBeCloseTo((5 * Math.PI) / 4, 5);
    expect(normalizeAngle(angles[3]!)).toBeCloseTo((7 * Math.PI) / 4, 5);

    // Distinct directions — not the old fixed 0.7 rad for every corner.
    const unique = new Set(angles.map((a) => a.toFixed(6)));
    expect(unique.size).toBe(4);
  });

  it("matches arcMidAngle for arcs", () => {
    const entity = arc("a", -0.2, 1.1);
    expect(radialDimensionAngle(entity, "c1")).toBeCloseTo(
      arcMidAngle(entity.startAngle, entity.endAngle),
      10,
    );
  });

  it("spreads circle leaders by constraint id (not arc mid)", () => {
    const circle: CircleGeometry = {
      id: "c",
      type: "circle",
      center: { x: 0, y: 0 },
      radius: 5,
      construction: false,
    };
    const a = radialDimensionAngle(circle, "radius-a");
    const b = radialDimensionAngle(circle, "radius-b");
    expect(a).not.toBeCloseTo(b, 5);
  });

  it("screen label offsets for four fillet corners aim outward differently", () => {
    const corners = [
      { start: 0, end: Math.PI / 2 },
      { start: Math.PI / 2, end: Math.PI },
      { start: Math.PI, end: (3 * Math.PI) / 2 },
      { start: (3 * Math.PI) / 2, end: Math.PI * 2 },
    ];
    const offsets = corners.map(({ start, end }, i) => {
      const entity = arc(`c${i}`, start, end);
      const angle = radialDimensionAngle(entity, `r-${i}`);
      return {
        x: Math.cos(angle) * 1.6,
        y: -Math.sin(angle) * 1.6,
      };
    });
    // TR → screen up-right, TL → up-left, BL → down-left, BR → down-right
    expect(offsets[0]!.x).toBeGreaterThan(0);
    expect(offsets[0]!.y).toBeLessThan(0);
    expect(offsets[1]!.x).toBeLessThan(0);
    expect(offsets[1]!.y).toBeLessThan(0);
    expect(offsets[2]!.x).toBeLessThan(0);
    expect(offsets[2]!.y).toBeGreaterThan(0);
    expect(offsets[3]!.x).toBeGreaterThan(0);
    expect(offsets[3]!.y).toBeGreaterThan(0);
  });
});
