# Changelog

All notable user-visible changes to WVC-CAD are documented here.

## [Unreleased]

### Added

- Drag placed dimension labels to reposition them (presentation-only `annotation.labelOffset`; undoable)
- Dimension drag moves label + leaders as a set; horizontal dims slide up/down, vertical left/right
- Product tagline: **Weekly** Vibe-Coded CAD (was Weekend)

## [0.1.0-alpha.4] — 2026-10-12

Pre-3D handoff + chamfer topology since `v0.1.0-alpha.3`.

### Added

- Pre-3D handoff: Pad topology fixtures; `SketchPlane` on frame (ADR-060, schema v1); closed line+arc offset via densified polyline (`OffsetWire`)
- Diagnostics `readyForPad` aligned with topology-only `isReadyForPad` (ADR-053)
- Chamfer topology residuals (ADR-061) — feature-owned connectivity; no blend coincidents on create

### Fixed

- Top-right / bottom-left rectangle chamfers no longer settle outside the profile (parent↔endpoint proximity pairing + inner wedge bias)

### Verification

- Local gate: typecheck, unit tests (551 passed / 1 skipped), build — pass
- Windows NSIS still **unsigned** (see PACKAGING.md)

### Known limitations

- **Alpha** — not production-ready; not suitable for safety-critical engineering
- Windows NSIS installers remain **unsigned** (SmartScreen warning expected; see PACKAGING.md)
- ADR-052 residual **row** scaling active; column scaling unused; dense solver comfortable for tens–low hundreds of constraints
- DXF export-only; approximate densified arc offset remains partial (see README)

## [0.1.0-alpha.3] — 2026-10-12

Repo review remediation (Phases 0–10) since `v0.1.0-alpha.2`.

### Fixed

- Mirror command preserves copied constraints; move undo restores constraints; selection pruned after trim/extend/mirror/fillet/chamfer
- Unsatisfied underdetermined sketches report `failed` (not mislabeled `inconsistent`)
- Dirty Open / Sample / Recent confirm before discarding work; save and open errors surface clearly
- DXF export fails closed on non-finite geometry
- Escape aborts in-progress Select drag without committing a move
- Keyboard `:focus-visible` rings; compact layout keeps the canvas usable; first-run tip Escape hint
- Canvas no longer re-runs under-constrained Jacobian visualization on every pan/zoom/preview frame
- Diagnostics reuses App solver / DOF viz results (no double solve per edit)
- CI solver timing gates use generous sanity ceilings; malformed-open E2E accepts dirty-discard confirm
- Axis-aligned H/V dimension leaders; fillet radius leaders aim at each corner arc; canvas pane fills host after resize

### Changed

- CI / Tauri workflows use `.nvmrc` + Corepack `packageManager` (npm 12) before `npm ci`
- [`THIRD_PARTY.md`](./THIRD_PARTY.md) lists Tauri JS plugins + Cargo crates and FS capability scope
- README feature-status (Supported / Partial / Unsupported); bug report template asks for version, OS, expected/actual
- Selection/snap performance baseline test (`SelectionPerformance.test.ts`)

### Verification

- Local Phase 10 gate: typecheck, lint, 531 unit tests (+1 skipped), build, 17 Playwright E2E — pass
- GitHub `main` CI green before tag

### Known limitations

- **Alpha** — not production-ready; not suitable for safety-critical engineering
- Windows NSIS installers remain **unsigned** (SmartScreen warning expected; see PACKAGING.md)
- ADR-052 residual **row** scaling active; column scaling unused; dense solver comfortable for tens–low hundreds of constraints
- DXF export-only; approximate densified arc offset remains partial (see README)

## [0.1.0-alpha.2] — 2026-10-11

### Added

- ADR-052 residual row scaling for LM + Jacobian rank (`ResidualScaling.ts`)
- Fillet rebuild opposite-wedge retry after large parent moves
- Playwright E2E for dimension edit, first-run tip dismiss, status-bar resize, and anchored-rectangle sample edit
- Hardened teaching samples (origin locate + driving dims); L-bracket replaces free mirrored pair
- Refined axes app icon (concept A) + updated favicon
- Clearer first-run / README quick-start tutorial path

### Fixed

- Bottom status bar disappearing on window resize / tool switch (shell layout)

### Dependency policy (PR review)

| Change | Decision |
|--------|----------|
| GitHub Actions (`checkout` / `setup-node` / `upload-artifact` v7) | Merged / applied locally |
| Dependabot npm majors (TypeScript 7, `@types/node` 26) | **Held** — stay on TypeScript `~6.0.2` and `@types/node` ^24 until a dedicated upgrade pass |
| Node engines | `>=22` (CI logs `node` / `tsc` versions) |

### Known Limitations

- ADR-052 residual **row** scaling shipped in this release; column scaling unused
- Solver comfortable for tens–low hundreds of constraints; 1,000-constraint residual-assembly baseline in `SolverScale.test.ts` (full LM/rank deferred)
- DXF export-only (import not yet supported)
- Windows builds unsigned (code signing not configured)

### Documentation

- See [PROGRESS.md](./docs/PROGRESS.md) for chunk history
- See [ROADMAP.md](./docs/ROADMAP.md) for next priorities
- See [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for design details

## [0.1.0-alpha.1] — 2026-10-11

### Added

- Parametric 2D sketch with geometric and dimensional constraints
- Levenberg–Marquardt solver with Jacobian-rank DOF (no fake fully-constrained)
- Undo/redo command history (Chunks 0–27 complete)
- Save / load versioned `.sketch.json`
- DXF R12 export (geometry-only; constraints stay in `.sketch.json`)
- Autosave + crash recovery
- Sample sketches under `public/samples/` (File → Sample: …)
- Tauri 2 desktop scaffold (Windows NSIS installer; MSI not used for `alpha` tags)
- Playwright critical-path E2E smoke test
