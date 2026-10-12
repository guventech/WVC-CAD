# Test Plan

## Goals

CAD behavior must be mathematically correct, not only visually plausible.
Every chunk keeps typecheck, unit tests, lint, and build green.
Do not claim features work without automated coverage for the critical path.

## Commands

```bash
npm run typecheck
npm run test
npm run test:e2e
npm run lint
npm run build
```

E2E: Playwright (`e2e/critical-path.spec.ts`) — rectangle → closed profile → fillet → ready-for-pad → save download. Requires `npx playwright install chromium` once.

## Tolerances

Centralized in `src/sketch/geometry/GeometryMath.ts`:

| Key | Typical use |
|-----|-------------|
| `TOLERANCE.geometric` | Exact geometry equality |
| `TOLERANCE.display` | UI / round-trip float noise |
| `TOLERANCE.coincidence` | Coincident, H/V and mm-dimension satisfaction |
| `TOLERANCE.angular` | Angle-dimension satisfaction (radians) |
| `TOLERANCE.solverResidual` | Solver convergence (later) |

Never use `===` for geometric float equality; use `isApproximatelyEqual`.

Hit / snap: screen-pixel tolerances (`HIT_TOLERANCE_PX`, `SNAP_TOLERANCE_PX`), independent of zoom.

## Current unit coverage (as of 2026-10-11; Chunks 0–27 + post-chunk tooling)

| Area | Location | Focus |
|------|----------|--------|
| Geometry math | `src/tests/geometry/GeometryMath.test.ts` | distance, closest-on-segment, arcs, tolerances |
| Rectangle math | `src/sketch/geometry/RectangleMath.test.ts` | diagonal corners, corner/edge drag, collapse reject |
| Camera | `src/sketch/viewport/Camera.test.ts` | world↔screen, pan, zoom-about-cursor, axes |
| Grid | `src/sketch/viewport/Grid.test.ts` | 1/2/5×10ⁿ mm spacing |
| Camera vs model | `src/sketch/viewport/CameraSketchIsolation.test.ts` | pan/zoom do not mutate Sketch |
| Hit testing | `src/sketch/selection/HitTesting.test.ts` | line/circle/arc/point, zoom in/out, overlap |
| Selection | `src/sketch/selection/SelectionManager.test.ts` | single/multi/clear/hover |
| Snap | `src/sketch/selection/SnapEngine.test.ts` | origin, grid, endpoint/point, midpoint, center, intersection, onEntity, H/V compose |
| 3-pt arc | `src/sketch/tools/Arc3Tool.test.ts` | circle-from-3-pts, reject collinear, three-click commit |
| Profiles / pad | `src/sketch/analysis/ProfileAnalyzer.test.ts` | open/hole/fillet/construction; `isReadyForPad` |
| Construction | `src/sketch/commands/ToggleConstructionCommand.test.ts` | create-as-construction, toggle, rectangle expand, profile filter |
| Point commands | `src/sketch/commands/PointCommands.test.ts` | create / move / delete |
| Line commands | `src/sketch/commands/LineCommands.test.ts` | create, endpoint/body move, reject zero-length, undo |
| Rectangle commands | `src/sketch/commands/RectangleCommands.test.ts` | create, corner/edge drag, feature delete, undo |
| Circle commands | `src/sketch/commands/CircleCommands.test.ts` | create, center/radius move, no-op command reject, undo |
| Arc commands | `src/sketch/commands/ArcCommands.test.ts` | create, wrap 0°, center/radius move, undo |
| Select tool | `src/sketch/tools/SelectTool.test.ts` | drag kinds from hits; rectangle feature selection |
| Selection summary | `src/sketch/selection/SelectionSummary.test.ts` | rectangle W×H vs free line |
| Constraint model | `src/sketch/constraints/ConstraintModel.test.ts` | catalog, graph, structural validate, add/undo |
| Coincident | `src/sketch/constraints/Coincident.test.ts` | merge, drag maintain, point-line, delete cleanup, undo |
| Coincident tool | `src/sketch/tools/CoincidentTool.test.ts` | two-pick point and point-line |
| Horizontal / vertical | `src/sketch/constraints/Orientation.test.ts` | line + point pair, drag keeps H/V, chain via coincident, H+V reject, rectangle duplicate, delete cleanup, undo/redo |
| Dimensions | `src/sketch/constraints/Dimensions.test.ts` | length/H/V distance/R/⌀/angle drive geometry, invalid values, reference vs driving, drag keeps length, rim drag rejected, conflict rollback (Fixture E), 100×50 rectangle |
| Constraint pick tool | `src/sketch/tools/ConstraintPickTool.test.ts` | pick → request mapping for H/V and each dimension tool |
| App constraints | `src/tests/app/AppConstraints.test.tsx` | line → H → length → edit 75 → invalid rejected → undo; H+V conflict message |
| Line tool | `src/sketch/tools/LineTool.test.ts` | start/preview/end, continue, H/V, cancel |
| Rectangle tool | `src/sketch/tools/RectangleTool.test.ts` | preview W/H, create, reject zero area, cancel |
| Circle tool | `src/sketch/tools/CircleTool.test.ts` | center/radius preview, create, reject zero R |
| Arc tool | `src/sketch/tools/ArcTool.test.ts` | center/start/end, sweep preview, reject zero, cancel |
| Solver (LM) | `src/sketch/solver/Solver.test.ts` | Cholesky, H/V/length/radius solve, drag with anchors, H+V inconsistent, 100×50 rectangle, Jacobian shape, under-constrained free geometry |
| Solver diagnose | `src/tests/solver/Solver.test.ts` | empty sketch `NO GEOMETRY` / 0 DOF; horizontal → under-constrained 3 DOF |
| Degrees of freedom | `src/sketch/constraints/DegreesOfFreedom.test.ts` | Fixtures A/B/C/D; free point 2 DOF; reference length does not reduce DOF |
| World datum frame | `src/sketch/constraints/WorldFrame.test.ts` + `SketchFrame.test.ts` | origin/axis coincident, immovable datums, hit/snap, fixtures C/D via frame |
| Under-constrained viz | `src/sketch/constraints/UnderConstrainedViz.test.ts` | free handles for free line / H line / point-on-axis; none when fully constrained |
| Over-constraint | `src/sketch/constraints/OverConstraint.test.ts` | H+V conflict set + unchanged sketch; duplicate length rejection |
| Dimension input | `src/sketch/constraints/DimensionInput.test.ts` | mm / ° / rad parsing and formatting |
| Sketch model | `src/tests/sketch/Sketch.test.ts` | empty sketch defaults |
| App shell | `src/tests/app/App.test.tsx` | Point/Line/Rect/Circle/Arc tools + construction mode |

## Geometry tests (expand with each entity)

- Vector / distance / angle / projection
- Intersections (`Intersections.ts` + snap/trim coverage)
- Hit testing at extreme zoom
- Serialization round-trip (`SketchSerializer.test.ts`)
- Polygon / slot / offset / DXF exporter unit tests under `src/sketch/**`

## Solver tests (Chunks 14–15)

- [x] Deterministic inputs → deterministic outputs
- [x] Convergence / residual / iteration limit
- [x] Inconsistent / failed leaves prior sketch unchanged
- [x] Under / over / DOF classification (Chunk 15) — Jacobian rank
- [x] Under-constrained free-handle visualization (Chunk 17)
- [x] Named conflict sets + dismiss UX (Chunk 16)
- [x] Canvas dimension edit + unit parsing (Chunk 18)
- [x] Line trim / extend (Chunk 19)
- [x] Mirror selected geometry (Chunk 20)
- [x] Line–line fillet / chamfer (Chunk 21)
- [x] Sketch diagnostics report + panel (Chunk 22)
- [x] Closed-profile / ProfileLoop analyzer (Chunk 23)
- [x] Performance baselines (Phase 7): `SolverPerformance` / `SolverScale` + `SelectionPerformance` (hit-test/snap); wall times logged, generous CI ceilings

## Mandatory regression fixtures (AGENTS §9)

| Fixture | Intent | Coverage |
|---------|--------|----------|
| A Free line | 4 DOF before constraints | `DegreesOfFreedom.test.ts` |
| B Horizontal line | 3 DOF (endpoints otherwise free) | `DegreesOfFreedom.test.ts` |
| C Fixed rectangle | 100×50 mm, corner at origin → fully constrained | `DegreesOfFreedom.test.ts` / `WorldFrame.test.ts` (coincident to origin + lengths) |
| D Circle R=20 at origin | fully constrained | `DegreesOfFreedom.test.ts` / `WorldFrame.test.ts` (coincident to origin + radius) |
| E Over-constrained line | reject / roll back | `Dimensions.test.ts` / Orientation H+V |
| F Open profile | three connected lines | `SketchDiagnostics.test.ts` (open endpoints / no closed profile) |
| G Hole | outer + inner loop | `ProfileAnalyzer.test.ts` (concentric circles) |

Keep selection/demo fixtures out of production App startup.

## E2E (Playwright)

Landed (`npm run test:e2e`; needs `npx playwright install chromium` once):

| Spec | Focus |
|------|--------|
| `critical-path.spec.ts` | Rect → profile → fillet → ready-for-pad → save |
| `save-reopen` / `autosave-recovery` / `malformed-open` / `dirty-open` | Persistence / recovery / dirty discard |
| `dimension-edit` | Length edit + undo/redo |
| `select-move` | Escape aborts in-progress drag |
| `export-dxf` / `over-constrained-sample` / `sample-anchored-rect` | Samples + DXF info tone |
| `onboarding` / `a11y-layout` / `status-bar-resize` | First-run tip, focus/compact layout, status bar |

## Known edge cases to keep covered

- Arc sweep across 0°
- Zero-length line / zero radius (reject); no-op geometry drags must not enter undo history
- Zoom-in and zoom-out hit/snap feel (screen px)
- Overlapping geometry priority (endpoint over edge/center)
- Camera operations do not alter model coordinates
- DOF from Jacobian rank only — never from dimension counts
- Rectangle stays axis-aligned under corner and edge drag
- Line-body translate preserves length and angle
- Circle/arc rim resize keeps center (arc also keeps angles)
- Coincident partners stay within `TOLERANCE.coincidence` after drag; delete removes dependent constraints
- Constrained drags: H/V and driving dimensions hold after any drag; unsatisfiable drags return the original sketch (no history entry)
- Rejected add/edit of a constraint leaves geometry **and** constraints unchanged
- **H/V + grid composition:** near-horizontal/vertical placement near a grid line must snap the free axis to that grid (not leave raw cursor). Add the same class of test whenever a new inference type can outrank grid.

## Definition of done (per chunk)

See AGENTS.md §15. Minimum for every chunk:

- [ ] Feature works in UI
- [ ] Model represents feature correctly
- [ ] Unit tests for the new math/commands
- [ ] `npm run typecheck` / `test` / `lint` / `build` pass
- [ ] Known limitations documented in PROGRESS.md / README.md
