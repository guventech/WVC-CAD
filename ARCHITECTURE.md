# Architecture

Parametric 2D mechanical sketcher. Rendering and React are views of a structured Sketch model.

## Stack (high level)

```text
UI (React)
  ↓ holds instance only
Sketch State (useState / future store)
  ↓
Sketch Model          ← source of truth (mm, no React)
  ↓
Geometry Engine       ← pure math / queries
  ↓
Selection / Snap / Hit testing   ← pure, zoom-aware screen tolerance
  ↓
Viewport / Camera / Canvas render ← view only; never mutates model
  ↓
Constraint System     ← data model + residual catalog (Tier 1–3 geometric + Fix + dimensions)
  ↓
Solver                ← Levenberg–Marquardt (Chunk 14) + Jacobian-rank DOF (Chunk 15)
World frame           ← fixed origin + X/Y datums (Pre–Chunk 16 / ADR-022); z reserved
Under-constrained viz ← free-handle markers from free Jacobian columns (Chunk 17 / ADR-023)
Over-constraint UX    ← conflict sets + dismissible panel alert (Chunk 16 / ADR-024)
Dimension edit        ← canvas double-click + unit parse (Chunk 18 / ADR-025)
Sketch diagnostics    ← pure analysis report + Sketch Analysis panel (Chunk 22 / ADR-030)
Profile analyzer      ← ProfileLoop + holes via nesting (Chunk 23 / ADR-031)
Serialization         ← versioned `.sketch.json` save/load (Chunk 25 / ADR-034)
Autosave / recovery   ← localStorage slot + dirty indicator (Chunk 26 / ADR-035)
CAD-like UI shell     ← MenuBar + DocumentBar + refined status (Chunk 27 / ADR-046)
```

Future (must not require React):

```text
Sketch → Validator → ProfileAnalyzer → 3D Feature Module → Kernel / STEP / STL
```

## Folder roles

```text
src/
  app/                 React shell; owns sketch instance + tool/selection UI state
  ui/                  Presentational React (toolbar, canvas binder, panels, status)
  sketch/
    model/             Sketch, SketchFrame, Geometry, Constraint, settings, ids
    geometry/          Point2D, tolerances, distance, arcs, shared math
    viewport/          Camera, grid spacing, canvas rendering (view)
    selection/         SelectionManager, HitTesting, SnapEngine (pure)
    commands/          Model mutations as undoable SketchCommand + CommandHistory
    tools/             Plain-TS tool controllers (Select, Point, Line, Rectangle, Circle, Arc)
    solver/            Variables, residuals, Jacobian, LM, Solver API
    constraints/       Catalog, factories, graph, maintenance façade → solveSketch
    serialization/     Versioned `.sketch.json` schema + serializer (Chunk 25)
    analysis/          ProfileAnalyzer, SketchDiagnostics, ProfileGeometry
    fixtures/          Temporary or test sketches
  tests/               App / shared tests (some tests are colocated under sketch/)
```

**Hard rule:** `src/sketch/**` must not import React or `src/ui/**`.

## Coordinate systems

| Space | Notes |
|-------|--------|
| World | Cartesian mm; origin `(0,0)`; X right; Y up |
| Screen | Canvas CSS pixels; Y down; converted via `Camera` |
| Camera | `scale` = px/mm; `originScreenX/Y` = screen position of world origin |

Pan and zoom never change geometry coordinates.

## Selection and snapping

- Hit tolerance and snap tolerance are **screen pixels**, independent of zoom.
- Priority (hit): endpoint > center > point > edge.
- Snap / inference (Chunk 9 + ADR-054): origin, endpoints, points, midpoints, centers, **intersections**, on-entity (line/circle/arc), grid (1/2/5×10ⁿ mm), temporary H/V (+ H/V·grid compose).
- Line/circle/arc placement may pass `alignTo` into `SnapEngine` for temporary horizontal/vertical inference. Inferences are visual only — they do not create constraints.
- Arc tools: center-point **Arc** and three-point **Arc3** (`circleFromThreePoints`); both commit via the same `createArc` command path.
- **Composition rule:** H/V inference emits pure H/V *and* H/V+grid (free axis snapped to nearest grid line). Do not let an orientation candidate use only the raw cursor free-axis value at a priority that always beats grid — that drops grid snaps on exact horizontals/verticals (see ADR-009).
- Construction geometry (Chunk 8): `construction: true` on entities; dashed render; create-as-construction mode; toggle command; excluded from `listSolidProfileGeometry` for future profiles.

## Commands and history (Chunk 24 / ADR-033)

- User edits go through `SketchCommand` (`apply` / `undo`) and `CommandHistory` (`execute` / `undo` / `redo`).
- Wired commands: geometry create/delete/drag, toggle construction, add/edit/delete constraint, trim/extend, mirror, fillet/chamfer, dimension edit.
- Helpers: `clearCommandHistory` (used on load), `peekUndoLabel` / `peekRedoLabel`.
- UI: History **Undo** / **Redo** in the top toolbar; Constraints panel can delete a constraint.
- App also binds Ctrl+Z / Ctrl+Y (or Ctrl+Shift+Z).

## Save / load (Chunk 25 / ADR-034)

- Interchange: `SketchDocument` JSON (`*.sketch.json`) via `sketchToDocument` / `parseSketchJson`.
- Includes `schemaVersion`, `units` (mm only), geometry, constraints, settings, frame, metadata.
- Browser File **Open** / **Save** (Ctrl+O / Ctrl+S); load clears undo history and syncs entity ids.
- Unsupported schema versions or non-`mm` units are rejected (no silent unit conversion).

## Autosave / recovery (Chunk 26 / ADR-035)

- Dirty = content fingerprint ≠ last Save/Open baseline (`SketchAutosave.ts`).
- Autosave writes a separate `localStorage` envelope (`sketcher.autosave.v1`), never the user download.
- Debounced while dirty; flushed on `beforeunload`; cleared when clean / after Save/Open / Discard.
- Startup recovery dialog: Restore or Discard; toolbar `*` + status **Unsaved changes**.

## Constraint data model (Chunk 10 / ADR-016)

- `Constraint` records: `type`, `references[]`, optional dimensional `value` + `driving`.
- Catalog covers geometric (coincident…fix), feature (`rectangle`), and dimensional (distance…coordinate-y) kinds.
- `ConstraintGraph` indexes entity↔constraint incidence; `ConstraintValidator` checks structure only.
- Factories build well-formed records; rectangle creation uses them for H/V/coincident/feature.
- Selecting any rectangle member expands selection to the whole feature; Properties show `W × H` (not a lone edge line).

## Coincident constraint (Chunk 11 / ADR-017)

- Tool: **Coincident** — pick point-like handle, then second point-like handle or a line.
- Patterns: point↔point, line endpoint↔circle/arc center, point↔line (project onto infinite line).
- On add: merge geometry, insert constraint (undoable).
- On drag: `applyGeometryDragWithConstraints` propagates point–point clusters and re-projects point–line.
- Delete geometry removes dependent constraints (including coincident).
- Coincident clusters remain useful for interpretation; enforcement of all maintained constraints goes through the Chunk 14 solver.

## Constraint solver (Chunk 14 / ADR-020)

```text
solver/
  SolverVariables.ts       free parameter vector X (anchors excluded)
  Residuals.ts             signed F(X) + engineering satisfaction gates
  Jacobian.ts              numerical ∂F/∂X (central differences)
  LinearAlgebra.ts         dense Cholesky / normal equations
  LevenbergMarquardt.ts    (JᵀJ+λI)δ = −JᵀF loop
  Solver.ts                solve() diagnose · solveSketch() apply
constraints/
  ConstraintMaintenance.ts façade: maintainConstraints → solveSketch
  DegreesOfFreedom.ts      rank(J) DOF + status classification / labels
  UnderConstrainedViz.ts   free Jacobian columns → free handles + summary
  OverConstraint.ts        conflict diagnosis for rejected add/edit
  DimensionInput.ts        unit parsing for dimension edit fields
```

- Supported equations: coincident (stored handles), horizontal/vertical, parallel/perpendicular (unit-direction sin/cos), tangent (line–curve / curve–curve on supporting circles), concentric (shared centers), midpoint (point at line mid), equal, symmetric, point-on-object, length, Euclidean `distance`, H/V distance, radius/diameter, angle, coordinate-x/y, Fix; `rectangle` / `fillet` feature topology residuals. Smart Distance UX maps picks onto length / H/V / `distance` (ADR-048).
- **Chamfer** features are rebuild-only (no solver residual); length/angle dimensions + geometry rebuild keep the blend. Documented intentional asymmetry vs fillet (ADR-045).
- **Anchors** (drag) remove those parameters from X so the grabbed handle stays put. Parallel/perpendicular between two *user* lines anchors the first-picked line so the second follows.
- **Rejection rule:** add, edit, and drag accept residual-OK `solved` or `under-constrained` results; over-constrained / inconsistent / failed keep the previous sketch.
- Degenerate “solutions” (zero-length line, zero radius) are rejected even if F≈0 (blocks H+V collapse-to-point).
- `solve(sketch)` does **not** mutate and does **not** run LM — it diagnoses **stored** geometry (residual gates + Jacobian rank). Interactive edits use `solveSketch` / `maintainConstraints`. After load, status reflects stored geometry until the next settling edit (or an explicit `solveSketch`).
- **Jacobian / DOF:** central finite differences; residuals mix mm and radians in one unscaled vector — mixed length+angle DOF fixtures lock current behavior. **Residual/column scaling is deferred** (ADR-052) until a concrete rank or large-edit failure requires it; DOF is never faked from dimension counts or closed-profile status.
- **Practical scale:** dense `JᵀJ` + per-variable residual rebuilds. Interactive solving is comfortable for tens–low hundreds of constraints; AGENTS §10’s 1,000-constraint target needs sparse/analytic Jacobians. Baseline: `SolverPerformance.test.ts` (~100 constraints).
- **Fillet geometry re-seating:** after LM, `reconcileCornerFeaturesAfterSolve` rebuilds derived blend arcs / restores driving lengths, then re-runs LM. It is not a second solver — residual satisfaction remains the acceptance gate (ADR-045).

## Geometry modules (actual layout)

Consolidated under `src/sketch/geometry/` (not the older AGENTS one-file-per-primitive plan): `Point2D.ts`, `GeometryMath.ts` (tolerances, projections, arcs), `EntityFeatures.ts`, `Intersections.ts` (line–line, line–circle, circle–circle), fillet/chamfer split across `FilletChamferMath.ts`, `FilletChamferOpsShared.ts`, `FilletRebuild.ts`, `FilletLengthRestore.ts`, `CornerFeatureReconcile.ts`, `RectangleEdgeOps.ts`, `FilletChamferApply.ts`, with `FilletChamferOps.ts` as a thin re-export barrel.

## App shell

`App.tsx` composes hooks: `useSketchDocument` (sketch+history+commands), `useSketchAutosave`, `useSketchFileIo`. Domain logic stays in `src/sketch/**`.

### CAD-like UI (Chunk 27 / ADR-046)

```text
MenuBar     File | Edit | Sketch | Constraints | Tools
DocumentBar New / Open / Save · document title · Undo / Redo
Tool row    Geometry toolbar + Constraint toolbar
Workspace   Side panels (Properties · Constraints · Analysis) | 2D Sketch canvas
StatusBar   X/Y · metrics · DOF · units · Ready  (+ secondary tool/snap/zoom)
```

Menus dispatch the same handlers as toolbars/shortcuts (no CAD logic in UI). Visual language is original engineering chrome — do not copy proprietary CAD icons or layouts.

## Select-tool geometry editing (ADR-015)

`GeometryDragTarget` (`src/sketch/commands/GeometryDrag.ts`) describes what is being dragged. `applyGeometryDrag` mutates the sketch; `createMoveGeometryCommand(sketch, target, from, to)` builds undoable history and **rejects no-ops** (apply leaves sketch unchanged).

| Hit | Drag kind | Behavior |
|-----|-----------|----------|
| Point | `point` | Move point; rectangle corner → feature resize |
| Circle center | `circle-center` | Move center; radius preserved |
| Circle rim | `circle-radius` | Radius = distance(center, cursor); center fixed |
| Arc center | `arc-center` | Move center; radius + angles preserved |
| Arc edge | `arc-radius` | Radius only; center + angles fixed |
| Free line endpoint | `line-endpoint` | Move start or end; reject zero length |
| Free line body | `line-body` | Translate via grab offset + stored span |
| Rect edge | `rectangle-edge` | 1-axis resize; opposite side fixed |
| Rect edge endpoint | `point` (corner id) | Mapped to corner drag |

Canvas preview calls the same apply function with ephemeral state; the model updates only on commit.

## Tools

- Controllers live in `src/sketch/tools/` as plain TypeScript.
- React (`SketchCanvas`) binds pointer events and renders previews; it does not own engineering state machines.
- Canvas UI is split for size: `canvasPointer` / `applyToolResult` / `dispatchActiveTool` + `useCanvasViewport` / `useCreationToolSession`.
- Viewport draw is split: `renderViewport` orchestrates; `drawViewportChrome` (grid/axes) and `drawToolPreviews` own stroke details.
- Active tools: `select`, `point`, `line`, `rectangle`, `polygon`, `slot`, `circle`, `arc`, `arc3`, `arcTangent`, `trim`, `extend`, `offset`, `mirror`, `fillet`, `chamfer`, `coincident`, `horizontal`, `vertical`, `dim-*` (see `ActiveTool.ts`). Shape create tools share a Rectangle ▾ flyout in the geometry toolbar.
- Line tool: click start → move with preview (X/Y/L/∠ + snap markers) → click end → continue from end; Escape cancels unfinished segment, second Escape (or Escape when idle) returns to Select.
- Rectangle tool: click opposite corners → 4 points + 4 lines + H/V/coincident + `rectangle` feature constraint (ADR-011). Feature-local corner/edge edit keeps axis-alignment (not the numerical solver).
- Circle tool: click center → radius preview (R) → click rim; zero radius rejected.
- Arc tools: center-point Arc; three-point Arc3; tangent Arc from a line endpoint.

## World Datum Frame (Pre–Chunk 16 / ADR-022)

Every sketch has `frame: SketchFrame` — origin + in-plane X/Y axes with stable datum ids. Datums are **not** in `geometry[]`. They participate in hit-test, selection, snap, and coincident residuals, but contribute **0** solver variables and cannot be deleted or dragged. Viewport axes/origin are drawn from `sketch.frame`. `FrameAxisTag` includes `"z"` for a future 3D Frame3D / sketch-plane binding.

Typical absolute lock: coincident a corner/center to `datum:origin`, **or** driving `coordinate-x` / `coordinate-y` (Offset Y / Offset X tools) plus sizes → `FULLY CONSTRAINED`.

## Under-constrained visualization (Chunk 17 / ADR-023)

Free solver variables (non-pivot Jacobian columns) map to geometry handles. Amber diamond markers show where motion remains; single-axis freedom adds a short H or V tick. Constraints panel + status tooltip explain the remaining DOF in plain language (not color alone). Dimension annotations include extension lines / arrows for length, distance, radius, and diameter (`drawDimensionLeaders.ts`).

**Fully-constrained entity coloring (ADR-049):** `fullyConstrainedEntityIds` marks entities whose body cannot leave its supporting place (free columns expanded through coincident clusters + rectangle corner topology; H/V edges may stay green under length-only freedom). Construction / hover / selected colors override. Driving `radius` / `diameter` hard-lock rim drag (size via dimension edit; center drag remains).

**Datum create snaps (ADR-050):** Rectangle/Circle commits with origin or axis snaps add coincident-to-origin or point-on-axis constraints (not Parallel).

## Over-constraint detection (Chunk 16 / ADR-024)

Failed add/edit operations leave the sketch unchanged and return a `ConstraintConflict` (proposed id + implicated existing ids + human reason). Constraints panel shows the alert, lists involved constraints, highlights them, and offers **Dismiss**.

## Dimension editing (Chunk 18 / ADR-025)

Driving dimension values edit from the Constraints panel or by double-clicking a canvas label (Select tool). `parseDimensionInput` accepts `75` / `75 mm` and `90` / `90°` / `rad`; model units stay mm / radians. Invalid input and solver conflicts are rejected without mutating the sketch.

## Trim and extend (Chunk 19 / ADR-026)

`Intersections.ts` provides line–line math. **Trim** removes the clicked interval of a line between cutters (other lines or world axes): end intervals keep the entity id; middle intervals split into two new lines and drop constraints that referenced the original. **Extend** grows the nearer endpoint to the nearest valid cutter along the ray. Rectangle feature edges are blocked. Ops run through undoable commands and `maintainConstraints` (reject on failure). Circles/arcs as trim/extend targets and break/split remain later work. Fillet/chamfer are Chunk 21.

## Mirror (Chunk 20 / ADR-027)

**Mirror** tool: select geometry, then click a sketch line or world X/Y axis. `MirrorMath` reflects points/lines/circles/arcs (arc start/end swapped to keep CCW). Copies are new entities; remappable geometric/dimensional constraints are copied with geometry (`MirrorConstraintCopy.ts`). Rectangle feature selection expands to all members. Undo restores prior geometry.

## Fillet and chamfer (Chunk 21 / ADR-028)

**Fillet** / **Chamfer** tools: click two lines, then click to set radius or chamfer distance (cursor distance from the mathematical corner). `FilletChamferMath` picks the wedge from the click, trims both lines, and adds a tangent fillet arc or chamfer segment. Fillet creates a `fillet` feature + driving radius dimension; the feature also contributes **topology residuals** (center-to-parent distance = R, parent near-ends glued along each parent to the tangent foot) so a located/sized R-driven filleted rectangle can report FULLY CONSTRAINED without catalog `tangent` equations. Along-line (1-D) glue is required — 2-D XY glue double-counts H/V and under-reports DOF. Arc angles are resynced after solve write-back (derived). Changing the radius (panel edit or arc-rim drag) **or dragging a connected line** rebuilds the connected line trims / arc so the blend stays closed. Open-corner Select-drag pins only the dragged trimmed edge (not virtual outer corners), then rebuilds all corner features. Offset X/Y on a rectangle group is **locate** (rigid-translate the group) when it is the only driving Offset on that axis, and **size** (move that edge + rebuild blends) when another same-axis Offset already pins the opposite side — so opposing Offsets like left=0 and right=250 resize without tearing fillets. **Chamfer** creates a `chamfer` feature plus driving **length** (face) and **angle** (vs the first parent line) dimensions but **no solver topology residuals** (rebuild-only, unlike fillet). Editing either dimension, or dragging a connected line, rebuilds the trims / face via length×angle construction. Adjacent **rectangle** edges are supported: each corner fillet/chamfer opens that corner on the `rectangle` feature (drops the corner point + topology residuals; keeps the feature and H/V) so later corners can still be blended. Chamfer also adds endpoint coincidents with its parents. After Select-tool constrained drags (and dimension edits), blends are rebuilt again because the solver can move parent lines without moving arcs (`reconcileCornerFeaturesAfterSolve` — geometry re-seating, then LM). If rebuild leaves a driving length on a filleted edge unsatisfied, the partner edge is shifted to restore that length (rigid translate when height/width is locked), then constraints are re-solved; failing restores reject the drag.

## Sketch diagnostics (Chunk 22 / ADR-030)

`analyzeSketchDiagnostics(sketch)` is a pure domain report (Geometry / Constraints / Profiles). It flags zero-length lines, zero-radius circles, invalid arcs, duplicate geometry, open endpoints, line–line self-intersections, non-manifold junctions, construction touching solid wires, remaining DOF, conflicting/redundant constraints, and unconstrained entities. Profile sections use `analyzeProfiles` (Chunk 23). The **Sketch Analysis** side panel renders the report; it never becomes the source of truth.

## Closed-profile detection (Chunk 23 / ADR-031)

`analyzeProfiles(sketch)` returns `ProfileLoop` records: `entityIds`, `closed`, `orientation` (CW/CCW), signed `area`, optional `parentLoopId` for holes. Solid **lines** and **arcs** form loops via degree-2 wire tracing (filleted rectangles count as closed); solid **circles** are atomic loops; nesting uses containment (circle/circle, circle inside polygon). Construction geometry is excluded. No 3D feature generation.

## Sketch → feature contract (pre-3D / ADR-053)

Future Pad / Pocket / Revolve modules must consume the sketcher **only** through:

```ts
analyzeProfiles(sketch) → ProfileAnalysis  // loops + open wire + intersection / non-manifold counts
isReadyForPad(analysis) → boolean          // topology gate for a single outer solid profile
```

| Invariant | Rule |
|-----------|------|
| Units | Millimetres; areas mm² |
| Construction | Never in solid loops (`listSolidProfileGeometry`) |
| Outer / holes | One preferred outer; holes nest via `parentLoopId` |
| Honesty | `readyForPad` does not imply DOF = 0; solver status stays separate |
| Bridge | No React, canvas, or SVG types cross this boundary |

Diagnostics may surface “Ready for pad” when `summary.readyForPad` is true (same domain gate).

## Line orientation on create

When the Line tool commits a segment that is perfectly horizontal or vertical (within coincidence tolerance), `createAddLineCommand` also inserts an H or V constraint — same idea as rectangle edges.

## Solver honesty

`solve(sketch)` reports residual satisfaction plus Jacobian-rank DOF (`under-constrained` / `solved` = fully constrained / `over-constrained` / `inconsistent`). DOF is never invented from dimension counts. Reference (non-driving) dimensions do not reduce DOF. Status bar and Constraints panel show text labels (e.g. `UNDER-CONSTRAINED — 3 DOF`, `FULLY CONSTRAINED`), not color alone. Closed-profile / “Ready for pad” status never overrides solver status (ADR-052).

## Fix constraint

**Fix** tool (one command): pick a point/endpoint/center, a **line** (locks both endpoints), or a **circle/arc** (locks center + radius). Stores the lock on `constraint.locked` and contributes matching residuals. World datums cannot be fixed.

## Performance / light-runtime rules

Keep the app usable on weak machines (and a future Tauri WebView2 shell):

| Rule | Practice |
|------|----------|
| Camera ownership | Camera lives in `SketchCanvas`. App only gets `camera.scale` (pan must not re-render App). |
| React cost | Memoize canvas/panels; stabilize document callbacks with `useCallback`. |
| Canvas cost | Batch grid into few `stroke()` calls; avoid per-line strokes. |
| Dependencies | Production: `react` + `react-dom` only. Prefer in-repo sketch code over new libs. |
| Build | Vite `target: es2022`, minify on, no release sourcemaps. |
| Placeholders | Do not ship unused capability stubs; add modules when the chunk lands. |

Desktop packaging scaffold: [PACKAGING.md](./PACKAGING.md) (`src-tauri/`, Tauri 2).

## Related

- Product and chunk plan: [AGENTS.md](./AGENTS.md)
- ADRs: [DECISIONS.md](./DECISIONS.md)
- Status: [PROGRESS.md](./PROGRESS.md)
- Tests: [TEST_PLAN.md](./TEST_PLAN.md)
- Packaging: [PACKAGING.md](./PACKAGING.md)
