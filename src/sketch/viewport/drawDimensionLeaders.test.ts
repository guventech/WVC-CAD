import { describe, expect, it } from "vitest";
import { orthogonalLeaderGeometry } from "./drawDimensionLeaders.ts";

describe("orthogonalLeaderGeometry", () => {
  it("keeps horizontal-distance leaders horizontal for diagonally placed points", () => {
    const a = { x: 0, y: 20 };
    const b = { x: 100, y: 0 };
    const geom = orthogonalLeaderGeometry(a, b, "horizontal", 10);

    expect(geom.dimA.y).toBe(geom.dimB.y);
    expect(geom.dimA.y).toBeGreaterThan(Math.max(a.y, b.y));
    expect(geom.dimA.x).toBe(a.x);
    expect(geom.dimB.x).toBe(b.x);
    // Must not be the diagonal A→B chord.
    expect(geom.dimA.y - geom.dimB.y).toBe(0);
  });

  it("keeps vertical-distance leaders vertical for diagonally placed points", () => {
    const a = { x: 0, y: 0 };
    const b = { x: 80, y: 100 };
    const geom = orthogonalLeaderGeometry(a, b, "vertical", 10);

    expect(geom.dimA.x).toBe(geom.dimB.x);
    expect(geom.dimA.x).toBeGreaterThan(Math.max(a.x, b.x));
    expect(geom.dimA.y).toBe(a.y);
    expect(geom.dimB.y).toBe(b.y);
  });
});
