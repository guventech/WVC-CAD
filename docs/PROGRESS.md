# Progress

## Completed

- [x] Chunk 0 — Repository foundation
- [x] Chunk 1 — 2D viewport and camera
- [x] Chunk 2 — Selection and hit testing
- [x] Chunk 3 — Point tool
- [x] Architecture prep (pre–Chunk 4) — I1, I2, I3, I5 (+ M1 fixture removal)
- [x] Chunk 4 — Line tool (+ H/V·grid compose fix)
- [x] Pre–Chunk 5 health / light-runtime pass
- [x] Chunk 5 — Rectangle tool
- [x] Chunk 6 — Circle tool
- [x] Chunk 7 — Arc tool (center-point)
- [x] Chunk 8 — Construction geometry
- [x] Chunk 9 — Snap / inference engine (subset)
- [x] Pre–Chunk 10 — Select-tool geometry editing + docs/review
- [x] Chunk 10 — Constraint data model
- [x] Chunk 11 — Coincident constraint
- [x] Chunk 12 — Horizontal / vertical constraints
- [x] Chunk 13 — Dimensional constraints
- [x] Chunk 14 — Constraint solver (Levenberg–Marquardt)
- [x] Chunk 15 — Degrees of freedom
- [x] Pre–Chunk 16 — World Datum Frame (fixed origin + X/Y axes)
- [x] Chunk 16 — Over-constraint detection (richer conflict sets + UX)
- [x] Chunk 17 — Under-constrained visualization
- [x] Chunk 18 — Dimension editing (canvas double-click + unit parsing)
- [x] Chunk 19 — Trim and extend
- [x] Chunk 20 — Mirror
- [x] Chunk 21 — Fillet and chamfer
- [x] Chunk 22 — Sketch diagnostics
- [x] Chunk 23 — Closed-profile detection
- [x] Chunk 24 — Undo/redo command system
- [x] Chunk 25 — Save/load
- [x] Chunk 26 — Autosave and recovery
- [x] Chunk 27 — CAD-like UI refinement

## Current

**Phase 3 file safety (2026-10-11).** Open / Sample / Recent confirm before discarding dirty work; save I/O errors surface a message; recovery Discard + truncated-JSON load covered.

**H/V dimension leaders (2026-10-11).** Horizontal/vertical distance (and coordinate) leaders stay axis-aligned with extension lines — no more diagonal “X” across filleted corners.

**Phase 2 solver honesty (2026-10-11).** Unsatisfied underdetermined sketches report `failed` (not `inconsistent`); ADR-052/ROADMAP/PROGRESS docs synced to row scaling + angle `1/L`; diagnostics cover zero-length lines and invalid arcs.

**Fillet radius leaders (2026-10-11).** Radial arrows/labels for arcs aim at the fillet sweep midpoint (no more shared up-right 0.7 rad leader for every corner).

**Canvas fill gap (2026-10-11).** `.canvas-pane` now flex-fills `.canvas-host` so the 2D sketch area no longer leaves an empty band below/right after resize (canvas intrinsic height was pinning the pane).

**Phase 1 mutation audit (2026-10-11).** Fixed `MirrorCommand` dropping copied constraints; move undo restores constraints; selection prune after trim/extend/mirror/fillet/chamfer; architecture-boundary Vitest gate.

**CI timing (2026-10-11).** `SolverScale` / `SolverPerformance` gate correctness + generous sanity ceilings; wall times logged (GHA was red on 15s/5s local-style thresholds).

**Alpha UX + deferred items (2026-10-11).** Status bar resize fix; hardened samples + tests; icon concept A. **ADR-052 row scaling landed** (`ResidualScaling.ts`; column scaling not used). Fillet rebuild retries opposite wedge on large moves. `v0.1.0-alpha.2` published.

**Reliability + onboarding (2026-10-11).** Playwright `dimension-edit` + `onboarding` specs; first-run tip and README quick-start clarified; ROADMAP items 1–3 marked done/current.

**CURSOR_AGENT_BRIEFING (2026-10-11).** P1–P5 addressed: CI logs Node/TS versions; TS7/`@types/node` 26 held on `~6.0.2` / ^24; DXF + intersection snap tests expanded; **solver scale test established as regression baseline** (`SolverScale.test.ts` — ~1,000-constraint residual assembly; full LM/rank deferred per ADR-052); `CHANGELOG.md` added; ADR-052 TODOs on `Solver.ts` / `DegreesOfFreedom.ts`; samples documented in README. Configs (`.oxlintrc.json`, `.prettierrc.json`, `.editorconfig`, `strict: true`) already present.

**Review brief P1 (2026-10-11).** P0–P1 T5–T9 landed; `v0.1.0-alpha.1` tagged (NSIS-only). Tauri close guard fixed (leaked `onCloseRequested` + `window.confirm` trapped the window). ADR-052 row scaling landed later the same day.

**Post–Chunk 27 + leftovers (2026-10-10).** N-gon sides, loop/chain offset, and Tauri 2 scaffold shipped (ADR-057 / ADR-010).

### Leftovers after 2D gap recheck (2026-10-10)

| Item | Landed |
|------|--------|
| N-gon sides | `[` / `]` / `−`/`+` / toolbar steppers; N 3–32 remembered (ADR-057) |
| Loop/chain offset | Closed profile loop → open degree-2 chain → segment; concentric circle |
| Tauri 2 | `src-tauri/` + `npm run tauri:dev` / `tauri:build` (needs Rust) |

### 2D gap recheck (2026-10-10)

| Item | Landed |
|------|--------|
| Size tool | `dim-radial` + `SmartRadial` — circle → ⌀ (Shift=R); arc → R (ADR-055) |
| DXF export | R12 ASCII geometry-only; `.sketch.json` stays SoT (ADR-056) |
| Polygon / Slot | Regular N-gon + capsule slot create tools |
| Tangent arc | `arcTangent` from line endpoint |
| Offset | Parallel line / chain / closed loop / circle |
| Dim leaders | Extension lines + arrows for length/distance/R/⌀ |
| Mirror copy | Remaps geometric/dimensional constraints with geometry |

**Post–Chunk 27 + 2D-before-3D Tier A/B/C (2026-10-10).** Profile handoff + intersection snap + 3-pt arc + Playwright smoke shipped.

### 2D-before-3D backlog (2026-10-10)

| Tier | What landed |
|------|-------------|
| A Profile | Stronger arc loop densify; non-manifold + self-intersection counts; construction exclusion; `isReadyForPad` + diagnostics “Ready for pad”; fixtures in `ProfileAnalyzer.test.ts` |
| A Solver | Residual **row** scaling landed (ADR-052); no fake fully-constrained; Jacobian comment |
| A Contract | ARCHITECTURE “Sketch → feature contract”; bridge = `analyzeProfiles` / `isReadyForPad` only (ADR-053) |
| B Snap/Arc | Intersection snap (`intersectionSnap.ts`); **Arc3** three-point tool + glyph/toolbar/menu (ADR-054) |
| C E2E | Playwright `e2e/critical-path.spec.ts` — rect → profile → fillet → ready-for-pad → save download (`npm run test:e2e`) |

**Post–Chunk 27 + UX parity U1–U5.** Icon toolbars, selection constraint palette, and chrome declutter shipped.

### UX parity U1–U5 (2026-10-09) — commercial-style constraint interaction

| Chunk | What landed |
|-------|-------------|
| U1 | `ToolIconButton` + original SVG glyphs; Geometry + Document bars icon-only (hover = name) |
| U2 | Constraint/Dimension toolbars icon-only; Offset labels match catalog (from X/Y-axis) |
| U3 | Domain `ConstraintApplicability.ts` — enable/disable + reasons from selection |
| U4 | `ConstraintContextBar` on Select; greyed boxes; apply or continue-pick; coincident failures surfaced |
| U5 | Constraint panel Related/All filter; feature rows de-emphasized; status Session disclosure |

**U6 (partial):** fully-constrained entity green stroke + hard-lock rim drag when driving radius/diameter exists; origin/axis create auto-coincidents for rectangle/circle (2026-10-09). Later landings covered polygon/slot/offset, dim leaders, Tauri scaffold, and mirror constraint copy — see Current section above.

### Fully-constrained green + radius rim lock (2026-10-09)

| Area | What landed |
|------|-------------|
| Domain | `fullyConstrainedEntityIds` from Jacobian free-column analysis (same pass as DOF markers) |
| Viewport | Solid geometry with no free solver vars drawn green (`VIEWPORT_COLORS.fullyConstrained`); construction / hover / selected override |
| Radius lock | Driving `radius` / `diameter` → SelectTool refuses rim drag; `GeometryEdit` early-out; center drag + dimension double-click unchanged |
| ADR | ADR-049 |
| Fix | Body-freedom green (H/V length-only OK); free floating rect none green; height-free rect only top non-green |
| Auto-create | Rectangle/Circle origin & axis snaps → datum coincident (ADR-050); edges on axes pin both corners |
| Fillet+axes | Edge `coordinate-x/y=0` locate; filleted `length` → outer H/V spans; length-restore skips rectangles; no invent-on-load; recreate tests for sketch-13 (ADR-051) |

### Unified Distance dimension (2026-10-09)

| Area | What landed |
|------|-------------|
| Model | Euclidean `distance` type + residuals; H/V distance kept for axis-aligned spans |
| UI | Single **Distance** tool replaces Length / H distance / V distance **and Offset X/Y** |
| Smart pick | Line×2=`length`; two points; two H/V lines; point/line + X/Y axis → `coordinate-*` locate |
| ADR | ADR-048 (extended) |

### Chunk 27 results (2026-10-06) — CAD-like UI refinement

| Area | What landed |
|------|-------------|
| Menu | `MenuBar` — File / Edit / Sketch / Constraints / Tools with working dropdown actions |
| Document | `DocumentBar` — New / Open / Save, dirty title, Undo / Redo |
| New | File → New sketch (+ Ctrl+N); confirms if dirty; clears autosave slot |
| Canvas | "2D Sketch" chrome label above viewport |
| Status | Primary strip (X/Y, metrics, DOF, units, Ready) + secondary session context |
| Theme | Original dark engineering chrome (CSS variables); no proprietary CAD assets |
| ADR | ADR-046 |

### Assessment remediation (2026-10-06) — pre–Chunk 27

Addressed items from [assessments.md](./assessments.md) (ADR-045):

| Area | What landed |
|------|-------------|
| Honesty | Removed unimplemented catalog `distance` type |
| Fillet | Split ops into Shared / Rebuild / LengthRestore / Reconcile / RectangleEdge / Apply + barrel |
| Dual path | Documented geometry re-seating; satisfaction invariant on reconcile |
| Solver | Central-difference Jacobian; ~100-constraint perf baseline; mixed length+angle DOF fixture; practical-limit docs |
| Loader | Reject zero-length lines / non-positive radii; load-then-diagnose test |
| Parallel | First-picked user line anchored so second follows |
| Intersections | Line–circle + circle–circle helpers |
| App | `useSketchDocument` / `useSketchAutosave` / `useSketchFileIo` (App shell ~358 lines) |
| Docs | Chamfer rebuild-only; `solve()` = stored-geometry diagnose; geometry folder reality |

Deferred: sign-retry (beyond fillet wedge), feature residual polymorphism, exact profile areas, hard tangent arc-sweep residual. (ADR-052 row scaling landed.)

### Point-on-object constraint (2026-10-06) — Tier 3 geometric catalog complete

| Area | What landed |
|------|-------------|
| Domain | `PointOnObject.ts` — segment foot (Δx, Δy), circle/arc radial + arc sweep penalty |
| Tools | **On object** — point + line/circle/arc edge (either order); datums rejected |
| UI | Canvas glyph `⌇`; Constraints toolbar |
| Guards | Duplicates rejected; distinct from coincident infinite-line point–line |
| ADR | ADR-044 |

### Symmetric constraint (2026-10-06)

| Area | What landed |
|------|-------------|
| Domain | `Symmetric.ts` — two point-like handles mirrored across a line/axis (Δx, Δy) |
| Tools | **Symmetric** — three picks: two points + mirror line (any order); world axes OK |
| UI | Canvas glyph `⇄`; Constraints toolbar |
| Guards | Duplicate pair+axis rejected; needs exactly two points and one line |
| ADR | ADR-043 |

### Equal constraint (2026-10-06) — Tier 3 started

| Area | What landed |
|------|-------------|
| Domain | `Equal.ts` — one residual: equal line lengths or equal circle/arc radii |
| Tools | **Equal** — two lines, or two curves (same kind; mixed rejected) |
| UI | Canvas glyph `=`; Constraints toolbar |
| Guards | Duplicates on same unordered pair rejected; world axes not accepted as lines |
| ADR | ADR-042 |

### Midpoint constraint (2026-10-06) — Tier 2 complete

| Area | What landed |
|------|-------------|
| Domain | `Midpoint.ts` — point at finite line midpoint (Δx, Δy); axes rejected |
| Tools | **Midpoint** — point-like + line (either order) |
| UI | Canvas glyph `M`; Constraints toolbar |
| Guards | Same-line endpoint rejected; duplicates rejected |
| Auto | Point / Line / Circle create from midpoint snap → Midpoint constraint (ADR-041) |
| ADR | ADR-040, ADR-041 |
| Tier 2 | Parallel, Perpendicular, Tangent, Concentric, Midpoint all shipped |

### Concentric constraint (2026-10-06)

| Area | What landed |
|------|-------------|
| Domain | `Concentric.ts` — two Δ equations (shared center XY) for circle/arc pairs |
| Tools | **Concentric** — two curve picks |
| UI | Canvas glyph `◎`; Constraints toolbar |
| Guards | Duplicate on same pair rejected |
| ADR | ADR-039 |

### Tangent constraint (2026-10-06)

| Area | What landed |
|------|-------------|
| Domain | `Tangent.ts` — line↔circle/arc (abs(d)−R) and circle↔circle (external/internal) |
| Solver | Side / mode captured at solve start (no flip mid-iteration) |
| Tools | **Tangent** — line+curve or two curves; world axes allowed as lines |
| UI | Canvas glyph `T`; Constraints toolbar |
| Limits | Contact point not required on arc sweep; follow-which quirks deferred (like parallel) |
| ADR | ADR-038 |

### Parallel / perpendicular constraints (2026-10-06)

| Area | What landed |
|------|-------------|
| Domain | `Parallel.ts` — unit-direction residuals (`sin θ` / `cos θ`); world axes allowed |
| Solver | One equation each; angular satisfaction tolerance |
| Tools | **Parallel** / **Perpendicular** — two line (or axis) picks |
| UI | Canvas glyphs `//` / `⊥`; Constraints toolbar |
| Guards | Duplicate / parallel+perp on same pair rejected; sketch unchanged on conflict |
| Known | Which line follows / angle sense can jump — deferred fix |
| ADR | ADR-037 |

### Fix constraint (2026-10-05)

| Area | What landed |
|------|-------------|
| Tool | **Fix** — one tool: point/endpoint/center, line (both ends), or circle/arc (center + radius); lock stored on `locked` |
| Solver | Two residuals (Δx, Δy); duplicate Fix on the same handle rejected; world datums rejected |
| UI | Canvas glyph `F`; Constraints toolbar |
| Fixture | Free point → 0 DOF; rectangle corner Fix → 2 DOF remaining (size); save/load keeps `locked` |

### Fillet topology residuals (2026-10-05)

A finished R-driven filleted box can honestly report **FULLY CONSTRAINED** without catalog `tangent` tools:

| Area | What landed |
|------|-------------|
| Residuals | `fillet` feature → center-to-parent dist = R + **1-D** along-line endpoint glue (not 2-D XY glue — that falsely removed size/locate DOF) |
| Angles | Arc start/end resynced after solve write-back (derived, not free DOF) |
| Drag | Open-corner Select-drag pins only the dragged trimmed edge; rebuild all corner features after edge move |
| Fixture | 200×200 R20 + four Offsets → DOF 0 / fully constrained |
| Regressions | Multi-fillet Offset locate/size, radius edit, extreme filleted edge drag |

### Fillet radius edit fix (2026-10-05)

Editing a fillet radius on a located box is covered by regression fixtures (100×100 with Length on filleted top+right edges + Offset at origin + TR fillet). Radius edit translates parents by ΔR, restores lengths, reconnects free rectangle corners, then settles — skipping a destructive re-trim when topology is already intact. Sibling fillets/chamfers are re-seated when present.

### Chunk 26 results (2026-10-05)

| Area | What landed |
|------|-------------|
| Autosave | Debounced dirty writes to `localStorage` envelope (`wvc-cad.autosave.v1`) |
| Recovery | Startup Restore / Discard dialog; never overwrites downloaded user file |
| Dirty | Content fingerprint vs last Save/Open; toolbar `*` + status **Unsaved changes** |
| Flush | `beforeunload` warns + writes autosave when dirty |
| ADR | ADR-035 |

### Chunk 25 results (2026-10-05)

| Area | What landed |
|------|-------------|
| Format | Versioned `*.sketch.json` (`schemaVersion`, mm units, geometry, constraints, settings, frame, metadata) |
| Domain | `sketchToDocument` / `parseSketchJson` + entity-id sync after load |
| UI | File **Open** / **Save** (Ctrl+O / Ctrl+S); history cleared on load |
| Checks | Reject non-mm units and unknown schema versions; round-trip + solver equivalence tests |
| ADR | ADR-034 |

### Chunk 24 results (2026-10-05)

| Area | What landed |
|------|-------------|
| Delete | `createDeleteConstraintCommand` — Constraints panel × removes one constraint |
| UI | Top-toolbar **Undo** / **Redo** (labels from stack); keyboard still works |
| History | `clearCommandHistory`, `peekUndoLabel` / `peekRedoLabel` |
| Tests | Delete constraint + create→constrain→edit dimension undo/redo round-trip |
| ADR | ADR-033 |

### Post–Chunk 23 fix (2026-10-05) — extreme filleted drag

Filleted rectangle + driving length + large/stepwise Select-drag of a perpendicular edge no longer tears blends:

| Area | What landed |
|------|-------------|
| Trim | `trimLineAtCorner` keeps the far end **into the body**, not merely farther from the corner |
| Wedge pick | `filletWedgePickPoint` walks into the longer segment arm (avoids exterior-wedge ties) |
| Length restore | Shift partner + connected blends; fit driven edge and snap sibling edges to partner tangents before rebuild |
| Safety | Drag rejected if fillet/chamfer topology is not intact after the pipeline |
| Test | Extreme stepwise bottom drag to y=−150 keeps joins + driving length |

### Axis-offset dimensions (2026-10-05)

| Area | What landed |
|------|-------------|
| Tools | **Offset X** / **Offset Y** — single pick → `coordinate-y` / `coordinate-x` |
| UX | Draw anywhere, then locate; axes fixed, edit moves sketch |
| UI | Canvas labels `Y …` / `X …`; panel names “Offset from X/Y-axis” |
| ADR | ADR-032 |

## Next

Near-term priorities (see [ROADMAP.md](./ROADMAP.md)):

- Sample sketches + File → Open sample…
- Quick-start / first-run onboarding polish
- Reliability fixes from alpha feedback; expand Playwright coverage
- Review-brief P2 solver robustness (T10 scaling) when a concrete failure appears; else expand E2E (T18)
- Code signing for Windows installers when certificate is ready — [PACKAGING.md](./PACKAGING.md)
- ADR-052 residual **row** scaling is in; column scaling intentionally not used (H/V regressions)

## Chunk 23 results (2026-10-05)

| Area | What landed |
|------|-------------|
| Domain | `analyzeProfiles` → `ProfileLoop` (area, CW/CCW, `parentLoopId` for holes) |
| Wire | Solid line + arc loops + circle loops; nesting (concentric circles, circle-in-polygon) |
| Open | `openEntityIds` for wire not in a closed loop |
| UI / diagnostics | Sketch Analysis shows outer/hole counts; profile findings use analyzer |
| Limits | Solid arcs not wired into loops yet; no 3D extrusion *(superseded — line+arc wire loops are supported; see Known limitations / ProfileAnalyzer)* |

## Chunk 22 results (2026-10-05)

| Area | What landed |
|------|-------------|
| Domain | `analyzeSketchDiagnostics` — geometry / constraints / provisional profiles |
| Checks | Zero-length/radius, invalid arcs, duplicates, open endpoints, self-intersections, non-manifold, construction-on-wire, DOF / conflicts / unconstrained |
| UI | **Sketch Analysis** side panel (`DiagnosticsPanel`) |
| Limits | Closed-profile detection is provisional (simple line loops + circles); full ProfileLoop is Chunk 23 |

## Chunk 21 results (2026-10-05)

| Area | What landed |
|------|-------------|
| Math | `FilletChamferMath.ts` — corner wedge, fillet arc + chamfer bevel |
| Ops | Trim two lines, add arc or chamfer segment; reject if `maintainConstraints` fails |
| Feature | Fillet: `fillet` + radius; Chamfer: `chamfer` + length×angle; line drag rebuilds |
| Rectangle | Adjacent edges OK; opens that corner on the `rectangle` feature (keeps feature + H/V); Offset locate = group translate, size = edge move + rebuild |
| Tools | **Fillet** / **Chamfer** — pick two lines, third click sets size (distance from corner) |
| Limits | No tangent solver equations yet |

## Chunk 20 results (2026-10-05)

| Area | What landed |
|------|-------------|
| Math | `MirrorMath.ts` — reflect point/line/circle/arc across an axis |
| Ops | `MirrorOps.ts` — duplicate selection across world axis or any line |
| Tool | **Mirror** — select geometry, click line or world axis; copies geometry only (no constraint clones) *(superseded — remappable constraints are copied; see Mirror copy / MirrorConstraintCopy)* |
| Undo | `createMirrorCommand` snapshots geometry |

## Chunk 19 results (2026-10-05)

| Area | What landed |
|------|-------------|
| Math | `Intersections.ts` — infinite / segment line–line intersections |
| Ops | `TrimExtendOps.ts` — line trim (end shorten / middle split) + extend to nearest cutter |
| Boundaries | Other lines + world X/Y axes; rectangle feature edges blocked |
| Tools | **Trim** / **Extend** on Geometry toolbar; single-click; undoable commands |
| Constraints | Failed maintenance rejects the op; middle split drops constraints on the removed id |

## Chunk 18 results (2026-10-05)

| Area | What landed |
|------|-------------|
| Parse | `DimensionInput.ts` — length (`75`, `75 mm`), angle (`90`, `90°`, `rad`) |
| Canvas | Double-click dimension label (Select tool) → floating editor; Enter commits, Esc cancels |
| Panel | Same parser for Constraints panel value fields |
| Checks | Invalid text rejected; negative/zero still blocked by dimension validation; undo/redo via edit command |

## Chunk 16 results (2026-10-05)

| Area | What landed |
|------|-------------|
| Diagnose | `OverConstraint.ts` — dry-solve conflict set + named reason for failed add/edit |
| Duplicate | Structural H+V / equivalent dims also return `conflict` ids |
| UX | Constraints panel alert lists involved constraints; highlight + Dismiss (sketch unchanged) |
| Contract | Failed ops never mutate the previous valid sketch |

## Chunk 17 results (2026-10-04)

| Area | What landed |
|------|-------------|
| Analysis | Free Jacobian columns → free handles (`UnderConstrainedViz.ts`) |
| Canvas | Amber DOF markers + single-axis ticks |
| Panel / status | Human DOF summary |

## Pre–Chunk 16 results (2026-10-04) — World Datum Frame

| Area | What landed |
|------|-------------|
| Model | `SketchFrame`: origin + X/Y axes (`z` reserved) |
| Constraints | Coincident to origin / axes; datums immovable |

## Known limitations (product)

- Fillet/chamfer: line–line corners and rectangle corners (opens corner on `rectangle` feature; Offset locate vs size)
- Chamfer topology is rebuild-only (no solver residual, unlike fillet)
- Tangent uses supporting circle (contact may lie off a drawn arc sweep)
- Frozen sign/side/mode captures can trap LM on large branch-crossing moves
- Dense solver: interactive comfort is tens–low hundreds of constraints (not yet 1,000)
- Mixed mm/radian residuals use ADR-052 row weights (column scaling not used)
- Whole-rectangle body drag translate still limited (Offset X/Y: locate rigid-translates; opposing same-axis Offsets size one edge + rebuild blends)
- Profile analyzer: line + arc wire loops + circles; area uses arc mid-samples
- Perfect H/V lines get orientation constraints on create
- Offset of mixed line+arc closed profiles is not rebuilt as a polyline loop
- DXF export is geometry-only (no import; constraints omitted)
- Tauri 2 scaffold exists (`npm run tauri:dev` / `tauri:build`); needs Rust; original icons + CSP landed; Windows builds still unsigned
- Parallel / perpendicular / tangent inference snaps during create remain a subset (intersection + H/V + on-entity are present)

## Living docs

| File | Role |
|------|------|
| [README.md](../README.md) | How to run |
| [AGENTS.md](../AGENTS.md) | Mission, chunk plan, agent rules |
| [ROADMAP.md](./ROADMAP.md) | Near-term public priorities |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Layer boundaries, performance rules |
| [DECISIONS.md](./DECISIONS.md) | ADRs |
| [TEST_PLAN.md](./TEST_PLAN.md) | Tests, tolerances |
| [PACKAGING.md](./PACKAGING.md) | Windows Tauri installer plan |
| [PROGRESS.md](./PROGRESS.md) | This file |
| [assessments.md](./assessments.md) | Historical architecture assessment |
| [THIRD_PARTY.md](../THIRD_PARTY.md) | Dependency licenses |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Contribution guide |
| [SECURITY.md](../SECURITY.md) | Vulnerability reporting |
