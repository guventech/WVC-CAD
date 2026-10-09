# Architecture Decisions

## ADR-001 — Geometry is model-owned

Date: 2026-10-02

Decision:
The Sketch model is the source of truth.
React state must never become the authoritative geometry representation.
React may hold the current `Sketch` instance and apply immutable updates produced by the sketch layer.

Reason:
Future constraint solving and 3D modules must operate without React.

---

## ADR-002 — Internal units

Date: 2026-10-02

Decision:
All geometry is stored internally in millimetres.

Reason:
Mechanical CAD workflow and future manufacturing modules.

---

## ADR-003 — Screen vs world separation

Date: 2026-10-02

Decision:
World geometry is never stored in screen pixels.
Camera (`worldToScreen` / `screenToWorld`) is view-only.
Hit and snap tolerances are defined in screen pixels so zoom does not change pick feel.

Reason:
Engineering correctness and consistent interaction at any zoom.

---

## ADR-004 — Honest solver stub

Date: 2026-10-02

Decision:
Until a mathematical solver exists, `solve` returns `not-implemented` and does not report DOF or fake “fully constrained” status.

Reason:
AGENTS.md: never fake solver behavior.

---

## ADR-005 — Commands own model mutations (target)

Date: 2026-10-02

Decision:
User edits should go through command objects (`execute` / `undo`) operating on the Sketch model, not ad-hoc React `setSketch` alone.
Until Chunk 24, a minimal history stack is acceptable; the command boundary must exist before the Line tool grows App wiring further.

Reason:
Architecture review I1 — avoid rewrite when undo/redo lands.

Status:
**Superseded for depth by ADR-033 (Chunk 24).** Core command + history boundary remains; Chunk 24 completes DeleteConstraint, toolbar Undo/Redo, and history helpers.

---

## ADR-006 — Tool logic outside React components

Date: 2026-10-02

Decision:
Active tools (select, point, line, …) should be plain TypeScript controllers.
React components bind pointer events and render previews; they do not own engineering state machines as the Line tool grows.

Reason:
Architecture review I2 — keep `SketchCanvas` from becoming a monolith.

Status:
**Implemented (pre–Chunk 4 prep through pre–Chunk 10).** Select/Point/Line/Rectangle/Circle/Arc tools are plain TS; canvas only binds input and rendering.

---

## ADR-007 — Shared geometry queries

Date: 2026-10-02

Decision:
Endpoint lists, arc endpoints, and similar entity features live in one geometry-query module used by hit testing, snap, and rendering — not copy-pasted `switch (entity.type)` blocks.

Reason:
Architecture review I3 — Line tool and inference will need the same data.

Status:
**Implemented (pre–Chunk 4 prep).** `src/sketch/geometry/EntityFeatures.ts` used by HitTesting, SnapEngine, and renderGeometry.

---

## ADR-008 — Temporary inference without constraints

Date: 2026-10-02

Decision:
During Line creation, horizontal/vertical/coincident/origin/grid snaps are temporary placement aids only.
Detected inferences are shown as snap markers and may adjust the click point; they do **not** create permanent constraint entities unless/until a later chunk adds explicit or configurable auto-constraints.

Reason:
AGENTS Chunk 4 — do not permanently create every detected inference.
Keeps the model honest before Chunk 10+ constraint data model.

Status:
**Implemented (Chunk 4).** Exception: midpoint snaps create Midpoint constraints on Point/Line/Circle commit (ADR-041). Perfect H/V lines still get orientation on commit (ADR-029).

---

## ADR-009 — Orientation inference must compose with grid on the free axis

Date: 2026-10-03

Decision:
When `alignTo` enables temporary horizontal/vertical inference, `SnapEngine` must emit **both**:
1. pure H/V candidates (free axis = cursor), and
2. H/V+grid candidates (locked axis = `alignTo`, free axis = nearest grid line)

with H/V+grid priority above pure H/V and below endpoint/origin.

Reason:
Bug found after Chunk 4: pure H/V (priority 70) always beat grid (40), so exact horizontals/verticals used the raw cursor on the free axis and never snapped to grid. Tools that add new inference types (rectangle, circle center, etc.) must compose with existing snaps the same way — a higher-priority inference must not silently discard useful lower-priority snaps on unconstrained axes.

Status:
**Implemented.** Regression tests in `SnapEngine.test.ts` and `LineTool.test.ts`.

---

## ADR-010 — Windows desktop via Tauri 2 (light shell)

Date: 2026-10-03

Decision:
Ship the eventual Windows `.exe` / installer with **Tauri 2** (OS WebView2 + Rust shell), not Electron.
Frontend remains the existing Vite + React app. CAD logic stays in `src/sketch/**`.

Reason:
Installer size and RAM matter for weak PCs. Tauri avoids bundling Chromium. See [PACKAGING.md](./PACKAGING.md).

Status:
**Decided; not scaffolded yet.** Add `src-tauri` after core tools/save are further along. Do not introduce Electron.

---

## ADR-011 — Rectangle as a coherent feature (pre-solver)

Date: 2026-10-03

Decision:
A rectangle is created as one undoable command that inserts:
- 4 corner `point` entities
- 4 edge `line` entities
- constraints: 1 `rectangle` feature record, 2× horizontal, 2× vertical, 4× coincident (adjacent edge ends)

Corner and edge drag use the `rectangle` feature (not a numerical solver) to update all four corners and edges so the shape stays axis-aligned. Deleting any member expands to the whole feature. The solver still reports `not-implemented` and does not claim DOF.

Reason:
AGENTS Chunk 5 requires a coherent parametric rectangle, not four unrelated lines. Full constraint solving is later; feature-local edit keeps topology honest without faking solver status.

Status:
**Implemented (Chunk 5; edge drag added pre–Chunk 10).**

---

## ADR-012 — Arc is center + radius + CCW angles (not a polyline)

Date: 2026-10-03

Decision:
Arcs are stored as `{ center, radius, startAngle, endAngle }` with a **counter-clockwise** sweep from `startAngle` to `endAngle` (world radians from +X). Rendering may tessellate for canvas stroke, but the model never becomes a polyline. Degenerate sweeps (`start ≈ end` after normalize) and non-positive radius are rejected. Chunk 7 ships **center-point** creation only; three-point and tangent arcs come later.

Reason:
AGENTS Chunk 7 — mathematical stability for hit testing, editing, and future constraints. CCW-only storage matches existing `arcSweepRadians` / `isAngleInArcSweep` helpers.

Status:
**Implemented (Chunk 7).**

---

## ADR-013 — Construction is a model flag, not a separate entity type

Date: 2026-10-04

Decision:
Construction/reference status is `geometry.construction: boolean` on every entity. Creating in Construction mode passes the flag through existing create commands. Toggle is an undoable command that expands rectangle features as one set. Future profile analysis uses `listSolidProfileGeometry` (excludes construction).

Reason:
AGENTS Chunk 8 — construction remains visible/selectable/constrainable but must not enter solid profiles.

Status:
**Implemented (Chunk 8).**

---

## ADR-014 — SnapEngine owns snap/inference candidates (renderer-free)

Date: 2026-10-04

Decision:
All snap/inference candidates are produced by `SnapEngine.collectSnapCandidates` / `findSnap` from model geometry + camera scale. Chunk 9 ships a subset: origin, endpoint, point, midpoint, center, onEntity, grid, horizontal/vertical (with H/V·grid compose). Tools only call `resolveSnappedPoint` / `snapInContext`.

Reason:
AGENTS Chunk 9 — one engine reused by every creation tool; no snap math in React.

Status:
**Implemented (Chunk 9 subset).** Intersection / parallel / perpendicular / tangent deferred.

---

## ADR-015 — Select-tool geometry drag via typed targets

Date: 2026-10-04

Decision:
Interactive edits after creation use an explicit `GeometryDragTarget` discriminated union (point, circle/arc center or radius, line endpoint, line body, rectangle edge). Select tool starts a drag from hit-test `part`; preview and commit both call `applyGeometryDrag`. Undoable history uses `createMoveGeometryCommand(sketch, target, from, to)`, which returns null when apply would not change the sketch.

Reason:
Circle-center drag set the pattern; lines, rectangles, and rim resize needed the same pipeline without inventing solver behavior or putting edit math in React. Typed targets keep undo correct for multi-parameter edits (e.g. line-body `grabOffset` + `span`).

Status:
**Implemented (pre–Chunk 10).**

---

## ADR-016 — Constraint data model before enforcement

Date: 2026-10-04

Decision:
Chunk 10 introduces the full constraint **type catalog** and record shape (`references`, optional `value` / `driving`) plus structural helpers (factories, incidence graph, structural validator, undoable add). Geometric satisfaction, conflict detection, and DOF remain unimplemented; the solver stays `not-implemented`. Constraint toolbar apply tools stay disabled until Chunk 11+.

Reason:
AGENTS Chunk 10 asks for the foundation without implementing every constraint behavior in one task. Separating data model from enforcement keeps honesty and avoids fake “fully constrained” UI.

Status:
**Implemented (Chunk 10).**

---

## ADR-017 — Coincident maintained locally before full solver

Date: 2026-10-04

Decision:
Chunk 11 enforces coincident constraints with a dedicated maintenance pass (`enforceCoincidentConstraints`) on add and geometry drag. Point–point clusters share one position; point–line projects onto the infinite line through the segment. The global `solve()` API stays `not-implemented` and does not report DOF.

Reason:
AGENTS requires moving one coincident handle to move the other without faking a complete solver. Local maintenance delivers the Chunk 11 success criteria while remaining honest about solver limits until Chunk 14.

Status:
**Implemented (Chunk 11).** Generalized by ADR-018.

---

## ADR-018 — Provisional constraint maintenance by weighted projection

Date: 2026-10-04

Decision:
Chunks 12–13 extend local maintenance into one loop, `maintainConstraints(sketch, anchors)`: coincident cluster pass, then one weighted projection per horizontal/vertical/driving-dimension constraint, repeated until every supported residual is within tolerance (`TOLERANCE.coincidence` mm, `TOLERANCE.angular` rad) or 200 sweeps pass. Dragged handles are anchors (weight 0); coincident clusters move as one handle. Any add, edit, or drag whose result is not satisfied is **rejected** and the previous sketch is kept. Geometry-drag undo restores a snapshot instead of dragging back.

Reason:
H/V and dimensions must hold during drags and edits before the Chunk 14 solver exists. A fixed-point projection is small, deterministic, and testable, and the satisfied/unsatisfied result gives honest rejection without claiming DOF. Rejecting instead of half-applying satisfies AGENTS §12 and Chunk 16's "failed operation leaves the sketch unchanged".

Consequences:
- Not a Newton/LM solver; convergence on long coupled chains may be slow, in which case the edit is rejected.
- With no Fix constraint, unanchored edits resize symmetrically.
- `solve()` still reports `not-implemented`. Chunk 14 should replace `maintainConstraints` behind the `Solver` interface while keeping the satisfied/rejected contract and the existing tests.

Status:
**Implemented (Chunks 12–13).** Superseded for enforcement by ADR-020 (projection loop replaced by LM). Rejection contract retained.

---

## ADR-019 — Dimensions are created at the measured value and edited as constraints

Date: 2026-10-04

Decision:
A dimension tool click creates a driving constraint whose `value` is the current measurement, so geometry never jumps on creation. Values change through `createEditDimensionCommand` (Constraints panel input: mm, or degrees for angle; the model stores radians). Reference dimensions (`driving: false`) are never enforced; panel and canvas show their live measurement. Switching reference → driving adopts the current measurement. Radius and diameter on the same entity are treated as one redundant family. Angle is the unsigned angle between line directions (start→end) in the open interval (0, π).

Reason:
Matches the CAD flow "draw approximately → constrain → edit values" (AGENTS §0, Chunk 13) and keeps validation in the command layer. Canvas double-click editing and unit parsing are left to Chunk 18.

Status:
**Implemented (Chunk 13).**

---

## ADR-020 — Levenberg–Marquardt solver behind Solver API

Date: 2026-10-04

Decision:
Chunk 14 replaces weighted projection with a Levenberg–Marquardt least-squares solver of F(X) = 0. Geometry parameters form X (points, line endpoints, circle/arc center+radius); drag anchors are omitted from X. Residuals are signed equations for coincident, H/V, and Chunk 13 driving dimensions, plus rectangle corner↔edge topology. `solveSketch` applies a successful solve; failures return the original sketch. `solve` diagnoses without mutating. Degenerate geometry (zero-length line / zero radius) is never accepted as solved. `maintainConstraints` becomes a thin façade over `solveSketch` so Chunk 11–13 call sites and the reject-on-failure contract stay intact. DOF classification is ADR-021.

Reason:
AGENTS Chunk 14 requires a real residual/Jacobian solver with tolerances, iteration limits, and failure diagnostics — without faking DOF. LM handles underdetermined systems via minimum-norm steps and is replaceable later behind the same interface.

Status:
**Implemented (Chunk 14).** Superseded for status/DOF reporting by ADR-021.

---

## ADR-021 — Jacobian-rank degrees of freedom

Date: 2026-10-04

Decision:
Chunk 15 computes DOF as `max(0, nVariables − rank(J))` from the assembled residual Jacobian at the current geometry (not from counting dimensions). `classifySketchStatus` maps residual satisfaction + DOF onto `under-constrained` / `solved` (fully constrained) / `over-constrained` / `inconsistent`. Driving `coordinate-x` / `coordinate-y` residuals anchor fixtures to the origin. `maintainConstraints` accepts residual-OK under-constrained sketches and still rejects over-constrained / inconsistent / failed edits. UI shows text status (`UNDER-CONSTRAINED — N DOF`, `FULLY CONSTRAINED`, …) plus tone; color alone is never the only signal. Reference dimensions never reduce DOF.

Reason:
AGENTS Chunk 15 forbids inventing “fully constrained” from dimension counts. Rank of J is the standard local DOF estimate for the residual system already built for LM.

Status:
**Implemented (Chunk 15).** Absolute anchoring preferred via ADR-022 world frame coincident rather than coordinate dims alone.

---

## ADR-022 — World Datum Frame (fixed origin + X/Y axes)

Date: 2026-10-04

Decision:
Every sketch carries a `SketchFrame` (origin + in-plane X/Y axes) that is **not** stored in `geometry[]`. Datums use stable ids (`datum:origin`, `datum:axis:x`, `datum:axis:y`). They are selectable, snappable, and constrainable (coincident point↔origin / point↔axis) but never solver variables, never deletable, never draggable. Viewport chrome draws from `sketch.frame`. `FrameAxisTag` includes `"z"` for a future Frame3D / sketch-plane binding; 2D sketches instantiate only x and y. Tier-3 Fix remains for pinning free geometry later; the frame is the permanent absolute reference.

Reason:
Without a fixed world reference, sketches cannot be fully constrained in the plane (rectangle width/height alone leave rigid-body DOF). Separating datums from user geometry avoids profile pollution and supports a clean 2D→3D handoff.

Status:
**Implemented (Pre–Chunk 16).** Absolute location may also use driving `coordinate-x` / `coordinate-y` (ADR-032) instead of coincident.

---

## ADR-023 — Under-constrained free-handle visualization

Date: 2026-10-04

Decision:
Chunk 17 explains remaining DOF by marking free Jacobian columns as free geometry handles. `matrixPivotColumns` identifies pivot vs free variables; `analyzeUnderConstrainedVisualization` groups them into handles (point / endpoint / center / radius) with freeX / freeY / freeRadius. Canvas draws amber markers; Constraints panel and status tooltip show a short summary (e.g. “1 handle free horizontally”). Dimension presentation stays label-based; technical-drawing arrows are deferred polish.

Reason:
AGENTS Chunk 17 requires users to understand *where* freedom remains, not only “N DOF.” Pivot-column free variables reuse the existing residual Jacobian without inventing DOF from dimension counts.

Status:
**Implemented (Chunk 17).**

---

## ADR-024 — Named over-constraint conflict sets

Date: 2026-10-05

Decision:
Chunk 16 extends reject-on-failure with `ConstraintConflict`: dry-solve after a proposed add/edit, collect unsatisfied / high-residual / structurally conflicting ids, and format a reason that names the involved constraints. Duplicate/H+V structural rejects also attach conflict ids. UI shows the message, lists involved constraints, highlights them in the panel, and provides Dismiss. The previous valid sketch is never mutated on failure.

Reason:
AGENTS Chunk 16 requires identifying why a constraint cannot be accepted and leaving the sketch unchanged — not only a generic “over-constrained” string.

Status:
**Implemented (Chunk 16).**

---

## ADR-025 — Canvas dimension edit + isolated unit parsing

Date: 2026-10-05

Decision:
Chunk 18 adds double-click editing of driving dimension labels on the canvas and routes panel/canvas text through `parseDimensionInput` (length mm; angle degrees by default, optional `rad`). Commit uses `createEditDimensionCommand` (solver + undo). Invalid parse or conflicting values reject without changing the sketch. Arrowed technical-drawing graphics remain out of scope.

Reason:
AGENTS Chunk 18 requires CAD-like dimension edit with unit parsing isolated from geometry validation.

Status:
**Implemented (Chunk 18).**

---

## ADR-026 — Line trim / extend with keep-id shorts and middle split

Date: 2026-10-05

Decision:
Chunk 19 implements line-only trim and extend against other lines and world-frame axes. End trims update the same line id; middle trims replace the entity with two new lines and remove constraints that referenced the trimmed id. Rectangle feature members are blocked. Operations are undoable commands that reject when `maintainConstraints` fails. Circle/arc trim and break/fillet stay out of scope.

Reason:
AGENTS Chunk 19 requires parametric model updates (not path editing) with constraint cleanup and undo. Keep-id end trims preserve as many constraints as possible; splitting requires new ids.

Status:
**Implemented (Chunk 19).**

---

## ADR-027 — Mirror duplicates geometry without cloning constraints

Date: 2026-10-05

Decision:
Chunk 20 mirrors selected geometry across a world axis or any sketch line. New entity ids are created; constraints are not copied (avoids broken duplicates). Arc reflection swaps start/end angles to preserve the CCW storage convention. Rectangle features expand to all members; mirrored copies are free geometry.

Reason:
AGENTS Chunk 20 requires H/V/construction-line mirror and explicitly warns against blindly duplicating broken constraints.

Status:
**Implemented (Chunk 20).**

---

## ADR-028 — Line–line fillet/chamfer without tangent solver equations

Date: 2026-10-05

Decision:
Chunk 21 implements fillet (trim + arc) and chamfer (trim + connecting line) for two intersecting lines. Corner wedge and size come from the third click. Fillet is stored as a `fillet` feature plus a driving radius dimension; radius edits and arc-rim drags rebuild both line trims and the arc so endpoints stay coincident/tangent by construction. The `fillet` feature also contributes **topology residuals** (center-to-parent distance = R, and each parent's near-end glued **along the parent line** to the tangent foot), so a located/sized R-driven filleted rectangle can honestly report FULLY CONSTRAINED without catalog `tangent` equations yet. 2-D XY endpoint glue is avoided — line endpoints already lie on their parents, and the extra equations falsely removed width/height/locate DOF. Arc angles are resynced after solve write-back (derived, not free DOF). Chamfer is stored as a `chamfer` feature plus driving **length** (face) and **angle** (vs the first parent) dimensions; create still picks equal setback, then records the resulting length×angle. Editing either dimension, or dragging a connected line, rebuilds via length×angle construction (not equal-setback-only). Adjacent rectangle edges are allowed: the `rectangle` feature stays, but the blended corner is opened (corner point + topology residuals dropped; H/V kept) so Offset / drag still treat edges + blends as one group. Chamfer create also adds endpoint coincidents between the face and its parents. Offset X/Y on a rectangle group follows CAD locate-vs-size intent: if no other driving same-axis Offset pins the group, edit rigid-translates the whole group (locate); if another same-axis Offset already exists, edit moves only that edge and rebuilds blends (size). Catalog `tangent` / `fix` remain Tier 2 (listed, not enforced as tools). Ops reject when `maintainConstraints` fails after trim.

Reason:
AGENTS Chunk 21 requires topology-safe trim and new geometry; adding unsolved catalog tangent tools would fake solver behavior. Feature topology residuals enforce corner connectivity for DOF/status while rebuild continues to seat geometry on edits. Length×angle matches common chamfer annotation. Keeping the rectangle feature with open corners preserves locate/Offset; opposing Offsets size one edge. Always rigid-translating on Offset broke size edits.

Status:
**Implemented (Chunk 21; fillet topology residuals + Offset locate/size 2026-10-05).**

---

## ADR-029 — Auto H/V on perfect line create

Date: 2026-10-05

Decision:
When `createAddLineCommand` commits a line that is axis-aligned within `TOLERANCE.coincidence`, it also inserts a horizontal or vertical constraint (undo removes it with the line). Temporary H/V snap inference during drawing remains visual-only until commit.

Reason:
Matches rectangle edge behavior and user expectation that a drawn horizontal/vertical line stays constrained.

Status:
**Implemented.**

---

## ADR-030 — Sketch diagnostics as a pure analysis report

Date: 2026-10-05

Decision:
Chunk 22 adds `analyzeSketchDiagnostics` under `src/sketch/analysis/`. The report aggregates geometry validity, constraint/solver status (reusing DOF + solve), and provisional profile topology (open endpoints, simple closed line loops, self-intersections, non-manifold junctions, construction-on-wire). The UI `DiagnosticsPanel` only displays the report. Full closed-profile / hole classification remains Chunk 23 (`ProfileLoop`).

Reason:
AGENTS requires an analysis panel without faking 3D readiness. Reusing the solver/DOF stack keeps constraint diagnostics honest. Keeping profile detection shallow avoids duplicating Chunk 23.

Status:
**Implemented (Chunk 22).**

---

## ADR-036 — Fix locks a point-like handle to captured world XY

Date: 2026-10-05

Decision:
**Fix** is one geometric constraint tool. The pick decides the lock shape:
- point-like handle → `locked: { x, y }`
- line entity → `locked: { x, y, endX, endY }` (both endpoints)
- circle/arc entity → `locked: { x, y, radius }` (center + radius)

World datums are rejected. Duplicate Fix on the same reference is rejected. There are no separate Line Fix / Circle Fix commands.

Reason:
Industry sketchers use one Fix/anchor tool; the selection determines what is locked. Capturing values on the constraint keeps residuals absolute and serializable.

Status:
**Implemented.**

---

## ADR-044 — Point-on-object pins to segment or curve rim

Date: 2026-10-06

Decision:
**Point-on-object** relates one point-like handle to one user line segment, circle, or arc. Line: residuals glue the point to `closestPointOnSegment` (finite segment, not infinite line). Circle/arc: radial residual `|P−C|−R`; arcs also penalize angle outside the CCW sweep. World axes are rejected (use coincident for datums). Distinct from coincident point–line, which uses infinite-line projection.

Reason:
AGENTS Tier 3 Point-on-object completes the geometric catalog for sketch-on-entity workflows (on-entity snaps vs infinite-line coincidence).

Status:
**Implemented.**

---

## ADR-043 — Symmetric mirrors two point handles about a line

Date: 2026-10-06

Decision:
**Symmetric** relates two distinct point-like handles across a mirror line or world axis (three references). Residuals force `reflect(first) = second` (Δx, Δy). Pick order is free; refs are normalized with points sorted and the axis last. Duplicate pairs on the same axis are rejected.

Reason:
AGENTS Tier 3 lists Symmetric after Equal. Point↔point about an axis is the core CAD symmetry constraint; entity-level line/circle symmetry can build on the same reflection math later.

Status:
**Implemented.**

---

## ADR-042 — Equal matches sizes of like entities

Date: 2026-10-06

Decision:
**Equal** relates two distinct user lines (equal length) or two circles/arcs (equal radius) with one residual `size(A) − size(B)`. Mixed line↔curve pairs and world axes are rejected. Tool requires two picks of the same kind; duplicates on the same unordered pair are rejected.

Reason:
AGENTS Tier 3 lists Equal first. One constraint type covers the common CAD equal-length and equal-radius cases without inventing a separate “equal radius” tool.

Status:
**Implemented.**

---

## ADR-041 — Midpoint snap during creation becomes a Midpoint constraint

Date: 2026-10-06

Decision:
When Point / Line / Circle creation commits with an active **midpoint** snap (`SnapCandidate.type === "midpoint"` + `sourceEntityId`), the create command also inserts a driving Midpoint constraint (same undo as the new entity). Line start and end are tracked separately; continuous line drawing carries the end snap as the next segment’s start snap. Temporary H/V / grid / endpoint snaps remain placement-only (ADR-008), except perfect H/V lines (ADR-029) and this midpoint case.

Reason:
Users expect snapping a new line endpoint (or point / circle center) to a midpoint to stay constrained, not only land visually at that point.

Status:
**Implemented.**

---

## ADR-040 — Midpoint pins a point to a line segment center

Date: 2026-10-06

Decision:
**Midpoint** relates one point-like handle to one finite user line: residuals force the point to `(start+end)/2`. World axes are rejected (synthetic unit segments have no useful midpoint). Using an endpoint of the same line is rejected (would collapse length). Tool accepts either pick order.

Reason:
AGENTS Tier 2 Midpoint completes the geometric Tier 2 set after Concentric.

Status:
**Implemented.** Creation auto-constraint from midpoint snaps: ADR-041.

---

## ADR-039 — Concentric shares circle/arc centers

Date: 2026-10-06

Decision:
**Concentric** relates two distinct circles or arcs with two residuals (Δx, Δy of centers). Radii stay independent. Tool picks two curves; duplicates on the same unordered pair are rejected.

Reason:
AGENTS Tier 2 lists Concentric after Tangent. Same center-equality equations as a center–center coincident, but as an explicit entity-level constraint for CAD UX.

Status:
**Implemented.**

---

## ADR-038 — Tangent as Tier 2 curve contact

Date: 2026-10-06

Decision:
**Tangent** relates a line (or world axis) to a circle/arc, or two circles/arcs. Residuals: line–curve uses signed distance to infinite line minus side×radius; curve–curve uses center distance minus (r1+r2) external or |r1−r2| internal. Side and mode are captured in `ResidualContext` at solve start (same pattern as fillet side signs) so Newton does not flip contact type mid-iteration. Arc tangency uses the supporting circle (sweep membership not required in v1).

Reason:
AGENTS Tier 2 lists Tangent after Parallel/Perpendicular. Catalog `tangent` tools unblock intentional line–circle contact beyond fillet topology residuals.

Status:
**Implemented.**

---

## ADR-037 — Parallel and perpendicular as Tier 2 line relations

Date: 2026-10-06

Decision:
Tier 2 geometric constraints **parallel** and **perpendicular** relate two distinct line objects (user lines or world X/Y axes). Residuals use unit-direction cross product (`sin θ` ≈ 0) and dot product (`cos θ` ≈ 0) so opposite-sense lines remain parallel. Tools pick two lines; structural duplicates and parallel+perpendicular on the same pair are rejected before solve. Axes are immovable, so parallel/perp to a datum orients free geometry.

Reason:
AGENTS Tier 2 order lists Parallel then Perpendicular after Fix. Shared line-relation helpers keep math out of React and reuse frame-axis hit testing.

Status:
**Implemented.** Known follow/angle-sense quirks deferred.

---

## ADR-035 — Local autosave slot for crash recovery (not the user file)

Date: 2026-10-05

Decision:
Chunk 26 writes dirty sketches to a dedicated browser `localStorage` autosave envelope (`sketcher.autosave.v1`), never to the user's last downloaded `.sketch.json`. Dirty state is content-fingerprint vs last explicit Save/Open. On startup, a recovery dialog offers Restore or Discard. Save/Open clear the autosave slot; `beforeunload` flushes autosave and warns when dirty. Status/toolbar show an unsaved-changes indicator.

Reason:
AGENTS requires local autosave, crash recovery, and an unsaved indicator without overwriting the primary user file.

Status:
**Implemented (Chunk 26).**

---

## ADR-034 — Versioned `.sketch.json` save/load without unit conversion

Date: 2026-10-05

Decision:
Chunk 25 persists sketches as versioned JSON (`schemaVersion`, `units: "mm"`, geometry, constraints, settings, optional world `frame`, metadata). Pure `sketchToDocument` / `parseSketchJson` live under `serialization/`; the browser shell downloads/opens files. Load rejects unknown schema versions and any units other than `mm` (never converts). Undo history is cleared on successful load; entity-id serials sync from loaded ids.

Reason:
AGENTS Chunk 25 requires round-trip fidelity and honest unit handling before autosave (Chunk 26) and packaging.

Status:
**Implemented (Chunk 25).**

---

## ADR-033 — Undo/redo history owns reversible parametric edits

Date: 2026-10-05

Decision:
Chunk 24 deepens the existing `SketchCommand` / `CommandHistory` stack: every reversible user edit continues to use `apply`/`undo` on the parametric model (no screenshot/state dumps). Missing pieces added: `createDeleteConstraintCommand` (Constraints panel ×), toolbar **Undo**/**Redo** beside keyboard Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z, and `clearCommandHistory` / peek labels for UI and future load. Execute still clears the redo stack; no-op apply does not push history.

Reason:
AGENTS Chunk 24 requires every user action to be reversible through model commands. History already existed; the gap was delete-constraint UX, non-keyboard undo/redo, and regression coverage for create→constrain→edit workflows.

Status:
**Implemented (Chunk 24).**

---

## ADR-032 — Axis-offset dimensions locate sketches to the world frame

Date: 2026-10-05

Decision:
Absolute placement relative to the immovable world X/Y axes uses driving `coordinate-y` (offset from X-axis) and `coordinate-x` (offset from Y-axis), exposed as dedicated tools **Offset X** / **Offset Y**. The user draws geometry anywhere, then picks a point (or a parallel edge) once—no axis pick and no forced order. Create adopts the measured value (no jump); editing the value moves user geometry because datums are never solver variables. Coincident to origin/axis remains for “on the datum”; dimensional locate is the primary offset workflow.

Reason:
Users need CAD-like locate dims (“25 mm from Y-axis”) without coincident, and without forcing a second pick of the axis. Reusing existing coordinate residuals avoids duplicate math.

Status:
**Implemented.**

---

## ADR-031 — ProfileLoop analyzer for 2D closed profiles

Date: 2026-10-05

Decision:
Chunk 23 adds `analyzeProfiles` returning structured `ProfileLoop` data (entity ids, orientation, area, optional `parentLoopId` for holes). Line and arc edges are extracted from solid wire with half-edge walking (so filleted rectangles remain closed profiles); circles are standalone loops; hole nesting uses geometric containment. Sketch diagnostics and the Analysis panel consume this module. 3D features remain out of scope.

Reason:
Future Pad/Pocket modules need reliable loop/hole classification without React or solver coupling. Keeping arcs out of the first wire graph avoids incorrect areas until arc tessellation exists.

Status:
**Implemented (Chunk 23).**

---

## ADR-045 — Assessment remediation (honesty, structure, solver clarity)

Date: 2026-10-06

Decision:
Address the post–Chunk-26 architecture assessment before Chunk 27 UI polish:

1. Remove unimplemented Euclidean `distance` from the constraint catalog/schema until residuals + a factory exist (no silent DOF holes).
2. Split fillet/chamfer ops into focused modules; keep `FilletChamferOps.ts` as a re-export barrel.
3. Treat `reconcileCornerFeaturesAfterSolve` as documented *geometry re-seating* after LM (not a second solver); non-null returns must remain residual-satisfied.
4. Document dense-solver practical limits; add a ~100-constraint performance baseline test; switch Jacobian to central differences; add mixed length+angle DOF fixture.
5. Reject zero-length lines / non-positive radii on load; clarify `solve()` diagnoses stored geometry only.
6. Chamfer remains rebuild-only (no topology residual) — intentional vs fillet.
7. Parallel/perpendicular between two user lines anchors the first-picked line so the second follows (datum relations leave the user line free).
8. Decompose `App.tsx` into `useSketchDocument` / `useSketchAutosave` / `useSketchFileIo`.
9. Line–circle and circle–circle intersections land in `Intersections.ts` for future curve trim/fillet.
10. Tangent contact still uses the supporting circle (arc sweep not a hard residual — hard sweep rejected valid line–arc tangents).

Deferred (documented, not faked): residual/variable nondimensional scaling; sign/side mode retry on large moves; feature residual polymorphism interface; exact profile arc areas.

Reason:
Assessment HIGH items risked honesty (latent `distance`), maintainability (fillet monolith / App shell), and scale/DOF clarity before UI growth.

Status:
**Implemented (prep pass).**

---

## ADR-046 — CAD-like UI shell with original chrome (Chunk 27)

Date: 2026-10-06

Decision:
Chunk 27 adds a real application menu bar (File / Edit / Sketch / Constraints / Tools), a compact document strip (New/Open/Save, dirty title, Undo/Redo), a labeled 2D Sketch canvas chrome, and a status bar split into primary engineering fields vs secondary session context. Visual styling uses an original dark engineering palette (CSS variables). Menus only invoke existing App/document handlers — no geometry or solver logic moves into UI components. Proprietary CAD icons, logos, and visual mimicry are explicitly avoided.

Reason:
AGENTS Chunk 27 requires a CAD-like layout after the engineering core is stable, while remaining an original sketcher product.

Status:
**Implemented (Chunk 27).**

---

## ADR-047 — Icon chrome and selection constraint palette (UX U1–U5)

Date: 2026-10-09

Decision:
1. Geometry, constraint, dimension, and document toolbars use original SVG icon buttons with full names in `title` / `aria-label` (no proprietary CAD icons).
2. Constraint enablement for selection is computed in domain module `ConstraintApplicability.ts`; React only renders greyed/enabled boxes.
3. With Select tool active, `ConstraintContextBar` shows all user constraints/dims; click applies when selection is complete or switches to pick mode for remaining picks.
4. Constraint panel defaults to Related-to-selection (All available); feature constraints are visually secondary; status secondary fields collapse behind Session.

Reason:
Align interaction with commercial sketchers (icons + selection-driven constraints) without moving CAD logic into UI.

Status:
**Implemented (UX U1–U5).** U6 backlog remains deferred.
