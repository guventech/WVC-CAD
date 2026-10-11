# Changelog

All notable user-visible changes to WVC-CAD are documented here.

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

- Residual/column scaling deferred (ADR-052)
- Solver comfortable for tens–low hundreds of constraints; 1,000-constraint residual-assembly baseline in `SolverScale.test.ts` (full LM/rank deferred, ADR-052)
- DXF export-only (import not yet supported)
- Windows builds unsigned (code signing not configured)

### Documentation

- See [PROGRESS.md](./docs/PROGRESS.md) for chunk history
- See [ROADMAP.md](./docs/ROADMAP.md) for next priorities
- See [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for design details
