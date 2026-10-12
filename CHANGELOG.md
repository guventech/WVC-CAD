# Changelog

All notable user-visible changes to WVC-CAD are documented here.

## [Unreleased]

### Fixed

- CI solver timing gates use generous sanity ceilings (GHA runners were failing 5s/15s local-style budgets)
- Canvas no longer re-runs under-constrained Jacobian visualization on every pan/zoom/preview frame (reuses App memo; recompute while dragging)
- Diagnostics panel reuses App `solve` / under-constrained results instead of solving twice per edit

### Changed

- Review-plan Phases 1–9: mutation/undo safety through CI hygiene and documentation readiness
- CI / Tauri workflows read Node from `.nvmrc` and activate `packageManager` via Corepack before `npm ci`
- [`THIRD_PARTY.md`](./THIRD_PARTY.md) lists Tauri JS plugins + Cargo crates and FS capability scope
- README feature-status (Supported / Partial / Unsupported); bug report template asks for version, OS, expected/actual

### Known limitations (current)

- Windows NSIS installers remain **unsigned** (SmartScreen warning expected; see PACKAGING.md)
- ADR-052 **row** scaling is active; column scaling unused; dense solver still tens–low hundreds of constraints for interactive work
- Not production-ready or suitable for safety-critical engineering

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
