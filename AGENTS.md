# WVC-CAD — current agent handoff

Local folder `CAD`; GitHub repository `guventech/WVC-CAD`. This is an experimental parametric **2D** mechanical sketcher, not a production or safety-critical CAD product.

## Start here

- Before implementation, read [README.md](README.md), [current progress](docs/PROGRESS.md) and [architecture](docs/ARCHITECTURE.md). Read [decisions](docs/DECISIONS.md) and [test plan](docs/TEST_PLAN.md) for the subsystem being changed.
- `package.json` and the lockfile own current versions and commands. After reconciling the existing remote freeze on 18 November 2026, the manifest is `0.1.0`, TypeScript `~6.0.2`, Node `>=22`, npm `12.0.2`.
- **Frozen v0.1.0 portfolio piece:** the existing remote decision of 18 October 2026 ended active development and further releases. Private-alpha, packaging and roadmap plans are historical. Preserve that lifecycle; documentation maintenance does not reopen features, tester invitations or releases.
- The [dated former AGENTS roadmap](docs/history/AGENTS-before-2026-11-18.md) and [old Cursor briefing](CURSOR_AGENT_BRIEFING.md) are historical references, not current instructions or evidence of completed capabilities. Chunk numbers in old prompts are not new implementation authorization.

## Engineering boundaries

- `Sketch` in world coordinates is the source of truth. World units are millimetres, X right and Y up. Screen conversion belongs to the camera; pan/zoom never changes model coordinates.
- `src/sketch/**` stays independent of React, UI and renderer-specific types. Reuse existing geometry/query/tolerance modules; keep CAD mathematics out of components.
- Model edits use `SketchCommand` and `CommandHistory`. Preserve undo/redo, dependent constraints, versioned serialization, autosave and recovery. A failed operation preserves the previous valid sketch and reports the failure; do not overwrite primary files without recovery.
- Constraint/DOF indicators must follow the actual solver and Jacobian analysis. Use centralized numerical tolerances; never fabricate constraint satisfaction, profile readiness or successful solving from UI appearance/counts.
- Preserve the topology-only profile-analysis contract and construction-geometry separation. Existing offset/chamfer approximations and DXF export limitations must remain visible; see README and architecture/decisions for exact limits.
- The implemented scope is a 2D sketcher. 3D solids, kernels, Pad/Pocket, STEP/STL, CAM/FEM, cloud collaboration, accounts/payments and AI geometry are outside the current scope unless a new task explicitly authorizes them. Future modules must consume the model without coupling it to a particular kernel.
- Work in one small, testable slice, reuse current abstractions and preserve interfaces. Avoid broad refactors and speculative dependencies. Explain any necessary dependency and follow the workspace approval rule before adding it.

## Privacy, licensing and release boundaries

- Keep business/brand strategy and confidential notes in ignored `private/`; only `private/README.md` is intended for Git. Never put confidential plans, secrets or private sketches in public docs, issues, logs or PRs.
- Preserve the MIT [license](LICENSE), [third-party notices](THIRD_PARTY.md), original UI assets and the no-affiliation disclaimer. Do not copy proprietary CAD branding, icons or chrome.
- Desktop packaging is Tauri 2, not Electron. [PACKAGING.md](docs/PACKAGING.md) defines Rust/WebView2 requirements and unsigned NSIS alpha limits. Extend packaging or publish releases only within an explicitly authorized task.
- Retain the alpha/not-safety-critical warnings. Existing release artifacts and dated test records do not prove a current checkout passes.

## Commands and verification

Use the manifest as the current command list. Normal setup is `npm ci`; development is `npm run dev`. Browser tests require a Playwright Chromium installation. Desktop commands additionally require Rust and WebView2.

For a behaviour change, run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, relevant `npm run test:e2e` cases and the affected manual workflow. `npm run check` combines typecheck, lint, unit tests and build. Geometry/solver work needs meaningful regression fixtures, including failure/rollback and round-trip/undo cases where relevant; never weaken a gate merely to pass it.

Update `docs/PROGRESS.md` with actual results/limits after a code change; update architecture/decisions when their contracts change. Report unavailable browser, installer or hardware checks honestly. The 18 November 2026 cleanup changed documentation only and did not rerun application tests or desktop builds.
