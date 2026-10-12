# WVC-CAD Review Findings

## Scope
This review covers the current state of the `guventech/WVC-CAD` repository as observed from the live codebase and project documentation, including architecture, CI, tooling, project docs, and main app structure.

## Executive summary

WVC-CAD is in strong overall condition for an alpha engineering CAD project. The repository demonstrates deliberate architecture, strong documentation, a real test strategy, and a mature engineering workflow. The project is not a rough unmaintained prototype; it has clear product scope, live progress tracking, solver/domain separation, and CI coverage.

The main remaining risks are not basic repo health problems. They are maintainability concerns around a large app shell and technical/scaling concerns around the solver and advanced feature set. These are realistic alpha-level concerns, not critical structural failures.

## Overall verdict

- Architecture: Strong
- Documentation: Strong
- CI/dev workflow: Strong
- Test coverage strategy: Good
- Current risk level: Low-to-medium for an alpha
- Main concerns: App size/complexity and solver/feature scaling

## What is already working well

### 1. Clear architecture and separation of concerns
The project is deliberately structured into:

- `src/app` for app shell and orchestration
- `src/ui` for UI/presentation
- `src/sketch` for CAD logic, solver, constraints, commands, geometry, serialization, and analysis

This is a very good fundamental pattern for a CAD app. The architecture boundary is reinforced by `src/sketch/ArchitectureBoundary.test.ts`, which checks that sketch-domain code does not import React or UI/app modules.

This is a strong sign that the project is intentionally designed rather than assembled ad hoc.

### 2. Strong project documentation and roadmap discipline
The repo includes:

- `README.md`
- `AGENTS.md`
- `docs/PROGRESS.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_PLAN.md`
- `CHANGELOG.md`
- `CONTRIBUTING.md`
- `SECURITY.md`

This is unusually mature for a repo of this type. The project doesn’t just “have code”; it has a living development plan and honest product status tracking.

### 3. CI and engineering workflow are in place
The GitHub workflow in `.github/workflows/ci.yml` runs:

- Node from `.nvmrc`
- install via `npm ci`
- `npm run check`
- Playwright E2E tests
- artifact upload on failure

This is a healthy baseline and indicates the project is being treated like a real software codebase rather than a personal prototype.

### 4. Tooling and stack are modern and appropriate
The repo uses:

- Vite
- React 19
- TypeScript strict mode
- Vitest
- Playwright
- Prettier
- OX lint
- Tauri for desktop packaging

This is a strong and relevant stack for a desktop/web CAD app.

### 5. The project is honest about limitations
The docs explicitly call out:

- alpha status
- solver scale limits
- offset/chamfer limitations
- DXF export-only behavior
- unsigned installer status
- other known engineering constraints

Honesty about limits is a major strength in alpha-stage engineering software.

## Main findings

### Finding 1: `src/app/App.tsx` is too large and responsible for too many concerns
`src/app/App.tsx` is doing a lot of work:

- document state management
- autosave wiring
- file I/O orchestration
- selection state
- tool state
- creation-session state
- keyboard shortcut handling
- menu action dispatch
- constraint conflict handling
- canvas prop wiring
- app-shell composition

This is not a correctness failure, but it is the largest maintainability risk in the codebase.

Why this matters:

- harder to reason about state transitions
- more fragile interactions between UI and CAD logic
- harder to test behavior in isolation
- more risk of regressions as features expand

Recommended direction:

- split App.tsx into smaller components/hooks
- extract keyboard logic into a dedicated hook
- extract menu action dispatch into a dedicated module
- consider `useReducer` or a central app state reducer for top-level app state
- keep CAD domain logic in `src/sketch` and keep UI state in app shell or UI layer

This is the main maintainability issue I would prioritize.

### Finding 2: Solver scale and advanced geometry features remain the primary technical risk
The project docs clearly describe that the solver is practical for:

- tens to low hundreds of constraints in interactive scenarios
- not yet optimized for extreme dense solves or huge feature sets

This is a realistic engineering limitation and not a flaw. However, it is still the most relevant technical risk if the project grows beyond current scope.

Relevant docs include:

- `docs/ARCHITECTURE.md`
- `docs/PROGRESS.md`

The repo already documents that limits such as:

- chamfer rebuild-only behavior
- partial offset rebuild support
- dense solver comfort limit
- mixed-geometry edge cases

These are acceptable in alpha, but they deserve explicit ongoing attention as the app grows.

### Finding 3: UI complexity is rising faster than the app-shell structure suggests
The project has a lot of stateful UI features and canvas interactions, and the top-level app shell is the aggregation point. This is common in CAD UIs, but it means the code will become difficult to maintain unless state ownership is cleaned up intentionally.

Suggested strategy:

- separate “document state” from “viewport state” from “tool UI state” from “global app state”
- prefer reducer/state machine pattern for tools and creation flows
- memoize heavy render props and callbacks where the canvas is expensive
- avoid re-rendering large canvas-related subtrees unnecessarily

### Finding 4: The repo is in a strong position; the remaining work is incremental refinement, not recovery
This is the most important positive conclusion: there is no sign of a broken or abandoned repo.

The project already handles:

- architecture design
- solver honesty
- configuration discipline
- autosave/recovery
- versioned sketch serialization
- CI automation
- progress documentation
- quality gates

These are exactly the things many engineering projects fail to establish early.

## Strengths to preserve

- The `src/sketch` boundary guard is very good
- The docs and roadmap are surprisingly mature
- The project keeps an honest alpha product status
- CI is in place and meaningful
- The code appears to be following a real engineering plan rather than random feature accumulation

## Recommended next priorities

### Priority 1: Refactor `src/app/App.tsx`
Main objective: reduce complexity and isolate responsibilities.

Suggested substeps:

- move keyboard handling into `useAppKeybindings` hook
- move menu action logic into a dedicated menu-action handler
- group document state and canvas state more clearly
- reduce prop drilling and callback churn
- add tests around app-shell state transitions

### Priority 2: Harden solver and geometry edge cases
Focus on:

- under-constrained / over-constrained transitions
- edge cases around fillet/chamfer rebuild logic
- offset edge cases
- mixed line/arc closed-profile logic
- dimension editing and constraint conflict handling

### Priority 3: Keep release and desktop packaging process rigorous
The Tauri build and installer pipeline should remain part of the release discipline.

Relevant concerns:

- unsigned Windows builds
- clear installer verification process
- packaging checks before release

### Priority 4: Keep the current documentation culture
The docs are an asset. Continue updating them as the project evolves.

## Conclusion

WVC-CAD is in good condition today. It is not a repo in crisis. The biggest remaining issues are maintainability and feature-scaling concerns—not fundamental architecture failure or lack of process.

The project’s strongest qualities are:

- honest project management
- modular architecture
- solver/domain separation
- CI discipline
- clear roadmap and progress tracking

If the team continues to keep scope and architecture disciplined, this repo is on a healthy path for steady, incremental improvement.

## Suggested action list for Cursor / follow-up work

1. Refactor `src/app/App.tsx` to separate state concerns
2. Extract keyboard and menu handlers into dedicated hooks/modules
3. Add targeted regression tests around solver edge behaviors
4. Review feature-level edge cases for chamfer/offset/mixed-profile operations
5. Keep release packaging checks explicit and scheduled
6. Continue documenting feature limitations and progress in `docs/PROGRESS.md`

## Review metadata

- Repo: `guventech/WVC-CAD`
- Default branch: `main`
- Review date: 2026-10-12
- Review type: repository health + architecture + project maturity review

## File references reviewed

- `package.json`
- `tsconfig.app.json`
- `tsconfig.node.json`
- `vite.config.ts`
- `.github/workflows/ci.yml`
- `README.md`
- `AGENTS.md`
- `docs/PROGRESS.md`
- `docs/ARCHITECTURE.md`
- `src/sketch/ArchitectureBoundary.test.ts`
- `src/app/App.tsx`
- `src/main.tsx`

## Final assessment in one line

WVC-CAD is a healthy and disciplined alpha CAD codebase with strong architecture and process, and the main work left is maintainability and feature-hardening rather than fundamental recovery.

---

This review should be used as a guide for iterative fixes and improvement work. It is intentionally practical and prioritized rather than purely theoretical.
