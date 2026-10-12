import { describe, expect, it } from "vitest";
import type { Geometry } from "../model/Geometry.ts";
import { createCamera } from "../viewport/Camera.ts";
import { hitTest } from "./HitTesting.ts";
import { findSnap } from "./SnapEngine.ts";

/**
 * Non-solver interactive hot-path baseline (Phase 7).
 * Correctness is CI-gated; wall times are logged with a generous sanity
 * ceiling — not an interactive product budget gate.
 */
describe("selection / snap performance baseline", () => {
  it(
    "hit-tests and snaps over ~200 entities",
    () => {
      const geometry: Geometry[] = [];
      for (let i = 0; i < 100; i += 1) {
        geometry.push({
          id: `line-${i}`,
          type: "line",
          start: { x: i * 12, y: 0 },
          end: { x: i * 12 + 10, y: (i % 3) * 2 },
          construction: false,
        });
        geometry.push({
          id: `circle-${i}`,
          type: "circle",
          center: { x: i * 12 + 5, y: 40 },
          radius: 4,
          construction: false,
        });
      }

      const camera = createCamera(800, 600, 2);
      const probe = { x: 50, y: 1 };

      const hitStarted = performance.now();
      let hitCount = 0;
      for (let n = 0; n < 200; n += 1) {
        const hit = hitTest(geometry, probe, { camera });
        if (hit !== null) {
          hitCount += 1;
        }
      }
      const hitMs = performance.now() - hitStarted;

      const snapStarted = performance.now();
      let snapCount = 0;
      for (let n = 0; n < 200; n += 1) {
        const snap = findSnap(probe, geometry, {
          camera,
          gridSpacingMm: 10,
        });
        if (snap !== null) {
          snapCount += 1;
        }
      }
      const snapMs = performance.now() - snapStarted;

      console.log(
        `~${geometry.length} entities × 200 probes: hitTest ${hitMs.toFixed(1)}ms ` +
          `(hits=${hitCount}), findSnap ${snapMs.toFixed(1)}ms (snaps=${snapCount})`,
      );

      expect(geometry.length).toBe(200);
      expect(hitCount).toBeGreaterThan(0);
      expect(snapCount).toBeGreaterThan(0);
      // Sanity ceilings only — shared CI runners vary widely.
      expect(hitMs).toBeLessThan(60_000);
      expect(snapMs).toBeLessThan(60_000);
    },
    90_000,
  );
});
