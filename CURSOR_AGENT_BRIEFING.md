# Cursor Agent Briefing — WVC-CAD Repository Review

**Date:** October 11, 2026  
**Repository:** guventech/WVC-CAD  
**Version:** v0.1.0-alpha.1  
**Language Composition:** TypeScript 98.6% + Other 1.4%

---

## Repository Overview

**WVC-CAD** is a parametric 2D mechanical sketcher built with TypeScript, React, and Vite. The sketch model is the single source of truth for all geometry, constraints, and solver state — React is purely a view layer. It's designed to enable future 3D CAD capabilities while keeping the 2D sketching workflow mathematically honest.

### Technology Stack
- **Framework:** Vite + React 19
- **Desktop:** Tauri 2 (Rust + WebView2 for Windows)
- **Core Math:** Custom Levenberg–Marquardt solver
- **Testing:** Vitest + Playwright
- **Tooling:** TypeScript 7, oxlint, Prettier
- **Build:** Vite (target: es2022, minified)

---

## Architecture Highlights

### Hard Boundaries (Non-negotiable)
- `src/sketch/**` must **never** import React or UI code
- Constraint solver operates independently; future 3D features will consume via `analyzeProfiles()` + `isReadyForPad()` only
- All mutations go through `SketchCommand` + `CommandHistory` (undo/redo)

### Key Layers
1. **Sketch Model** (`src/sketch/model/`) — Source of truth: geometry + constraints
2. **Solver** (`src/sketch/solver/`) — Levenberg–Marquardt + Jacobian-rank DOF
3. **Constraint System** (`src/sketch/constraints/`) — 18+ constraint types; data model + enforcement
4. **Tools** (`src/sketch/tools/`) — Plain TypeScript (no React); canvas binds input + renders previews
5. **Analysis** (`src/sketch/analysis/`) — ProfileAnalyzer, SketchDiagnostics, DOF calculation
6. **Persistence** (`src/app/fileStorage/`) — Versioned `.sketch.json` + autosave + recovery

---

## Actionable Issues & Recommendations

### 🔴 **Priority 1: Dependency Updates & CI Health**

#### Issue 1.1 — Pending Dependency PRs
**Status:** 4 PRs closed but not merged (TypeScript 7.0.2, @types/node 26.6.4, etc.)

**What needs doing:**
- Review PR #5 (TypeScript 7.0.2 bump) for breaking changes
- Review PR #6 (@types/node 26.6.4) for compatibility with current codebase
- Review PR #3 (actions/checkout v4→v7) — has "rebasing" note; check if CI is blocked
- Decide: merge, reject with rationale, or update before merge

**Files to check:**
- `package.json` — engines, tsconfig compatibility
- `.github/workflows/*.yml` — any version-specific CI steps
- `tsconfig.json` — strict mode enabled?

**Acceptance criteria:**
```
- [ ] All 6 PRs reviewed
- [ ] Merged or explicitly rejected with documented reason
- [ ] CI passes on all branches
- [ ] No console warnings during `npm run build`
```

---

#### Issue 1.2 — Node.js + TypeScript Version Mismatch Check
**Current state:** `package.json` specifies `"engines": { "node": ">=22" }` and `"typescript": "~6.0.2"` (tight pin)

**Action:**
1. Verify TypeScript 7.0.2 compatibility with Node 22
2. If upgrading TS, update pin to `^7.0.2` or stay strict (e.g., `7.0.2`)
3. Add explicit engine version check to CI

**Files to modify:**
- `package.json` — clarify version constraints
- `.github/workflows/ci.yml` — add Node/TS version logging

---

### 🔴 **Priority 2: Test Coverage Gaps**

#### Issue 2.1 — Missing DXF Exporter Tests
**Current state:** DXF export (R12 ASCII, geometry-only) exists but has no unit tests

**What needs doing:**
- Create `src/sketch/export/DxfExporter.test.ts`
- Test cases:
  ```typescript
  ✓ Export single line → LINE entity
  ✓ Export circle → CIRCLE entity
  ✓ Export arc → ARC entity
  ✓ Export construction geometry → CONSTRUCTION layer
  ✓ Reject DXF import (not yet supported)
  ✓ Round-trip geometry (export → parse → compare)
  ✓ Constraints are NOT in DXF (document this; they stay in .sketch.json)
  ```
- Add note: "DXF is geometry-only interchange. Use `.sketch.json` for full model."

**Files involved:**
- Create: `src/sketch/export/DxfExporter.test.ts`
- Reference: `src/sketch/export/DxfExporter.ts` (implementation)
- Reference: `docs/DECISIONS.md` ADR-056

**Acceptance criteria:**
```
- [ ] DxfExporter.test.ts created with ≥8 test cases
- [ ] 100% coverage for export path (happy path + error cases)
- [ ] .test file documents constraint limitation
- [ ] All tests pass: npm run test
```

---

#### Issue 2.2 — Intersection Snap Test Coverage Expansion
**Current state:** `intersectionSnap.ts` mentioned in PROGRESS.md (Chunk 9); SnapEngine.test.ts exists but may lack intersection-specific tests

**What needs doing:**
1. Review `src/sketch/selection/SnapEngine.test.ts` — find intersection test cases (if any)
2. If sparse, add:
   ```typescript
   ✓ Line–line intersection (finite segments)
   ✓ Line–line intersection (one/both infinite) — snaps to segment end only
   ✓ Line–circle intersection (2 solutions; both offered)
   ✓ Circle–circle intersection (external + internal; 0/1/2 solutions)
   ✓ Arc–line intersection (respects CCW sweep)
   ✓ Arc–arc intersection (respects both sweeps)
   ✓ Intersection priority vs endpoint/midpoint/center (should rank between endpoint and midpoint)
   ```

**Files involved:**
- Reference: `src/sketch/selection/SnapEngine.test.ts`
- Reference: `src/sketch/selection/SnapEngine.ts` (implementation)
- Reference: `src/sketch/geometry/Intersections.ts` (math helpers)

**Acceptance criteria:**
```
- [ ] Intersection snap tests exist in SnapEngine.test.ts
- [ ] ≥6 test cases (line–line, line–circle, circle–circle, arc–line, arc–arc, priority)
- [ ] All tests pass: npm run test
- [ ] Coverage report shows Intersections.ts >90%
```

---

#### Issue 2.3 — Solver Scale Test (1,000-Constraint Baseline)
**Current state:** Solver documented as comfortable for "tens–low hundreds of constraints"; scaling deferred (ADR-052)

**What needs doing:**
1. Create `src/sketch/solver/SolverScale.test.ts` — a single baseline test
2. Test fixture: 1,000 constraints (mix of geometric + dimensional)
   ```typescript
   const sketch = createBench1000Constraints();
   const start = performance.now();
   const result = solveSketch(sketch);
   const elapsed = performance.now() - start;
   
   expect(result.status).toBe('solved' | 'under-constrained');
   expect(elapsed).toBeLessThan(5000); // 5 sec timeout
   console.log(`Solved 1,000 constraints in ${elapsed}ms`);
   ```
3. Add TODO comment referencing ADR-052 (residual/column scaling deferred)
4. Document this as a performance regression baseline for future work

**Files to create:**
- Create: `src/sketch/solver/SolverScale.test.ts`
- Modify: `src/sketch/solver/Solver.ts` — add TODO for scaling

**Acceptance criteria:**
```
- [ ] SolverScale.test.ts created with 1,000-constraint fixture
- [ ] Test logs elapsed time (for regression tracking)
- [ ] Test includes TODO referencing ADR-052
- [ ] Test runs but may timeout/fail (that's OK; baseline established)
- [ ] docs/PROGRESS.md updated: "Solver scale test established as regression baseline"
```

---

### 🟡 **Priority 3: Documentation & Configuration**

#### Issue 3.1 — Create CHANGELOG.md
**Current state:** v0.1.0-alpha.1 tagged; no CHANGELOG documenting user-visible changes

**What needs doing:**
1. Create `CHANGELOG.md` (Markdown format, semantic versioning)
2. Structure:
   ```markdown
   # Changelog

   ## [0.1.0-alpha.1] — 2026-10-11

   ### Added
   - Parametric 2D sketch with 18+ constraint types
   - Levenberg–Marquardt solver with DOF calculation
   - Undo/redo system (27 chunks completed)
   - Save/load (`.sketch.json` versioned format)
   - DXF export (geometry-only)
   - Autosave + recovery
   - Tauri 2 desktop scaffold (Windows NSIS/MSI)

   ### Known Limitations
   - Residual/column scaling deferred (ADR-052)
   - Solver comfortable for <200 constraints; 1,000-constraint target in backlog
   - DXF export-only (import not yet supported)
   - Windows builds unsigned (code signing not configured)

   ### Documentation
   - See [PROGRESS.md](./docs/PROGRESS.md) for chunk history
   - See [ROADMAP.md](./docs/ROADMAP.md) for next priorities
   - See [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for design details
   ```

**Files to create:**
- Create: `CHANGELOG.md` (root level)

**Acceptance criteria:**
```
- [ ] CHANGELOG.md created
- [ ] v0.1.0-alpha.1 section captures Added/Changed/Known Limitations
- [ ] Links to PROGRESS.md, ROADMAP.md, ARCHITECTURE.md
- [ ] No external links (self-contained)
```

---

#### Issue 3.2 — Explicit Linter & Formatter Configuration
**Current state:** oxlint + Prettier used; no explicit config files → using defaults

**What needs doing:**
1. Create `.oxlintrc.json` in root
   ```json
   {
     "env": {
       "browser": true,
       "es2022": true,
       "node": true
     },
     "rules": {
       "react/hook-use-state": "warn",
       "react/no-unescaped-entities": "warn"
     }
   }
   ```
2. Create `.prettierrc` in root
   ```json
   {
     "semi": true,
     "trailingComma": "es5",
     "singleQuote": true,
     "printWidth": 100,
     "tabWidth": 2
   }
   ```
3. Verify `.editorconfig` (if exists) aligns with `.prettierrc`

**Files to create:**
- Create: `.oxlintrc.json`
- Create: `.prettierrc`
- Verify: `.editorconfig`

**Acceptance criteria:**
```
- [ ] .oxlintrc.json created with React + TypeScript rules
- [ ] .prettierrc created with 2-space indent, single quotes, 100-char width
- [ ] npm run lint runs without warnings (or document necessary suppressions)
- [ ] npm run format:check passes
```

---

#### Issue 3.3 — tsconfig.json Audit for `strict: true`
**Current state:** Not visible in briefing; need to verify `strict` mode enabled

**What needs doing:**
1. Open `tsconfig.json`
2. Verify `"compilerOptions": { "strict": true }` is set
3. If not, enable it incrementally (may require code fixes)
4. Document any `@ts-ignore` or `@ts-expect-error` suppressions with reason

**Files to check:**
- `tsconfig.json` — look for `compilerOptions.strict`

**Acceptance criteria:**
```
- [ ] tsconfig.json verified or updated to enable strict mode
- [ ] npm run typecheck passes with zero errors
- [ ] If suppressions exist, document reason in adjacent comment
```

---

### 🟡 **Priority 4: Solver Honesty & Scaling (ADR-052)**

#### Issue 4.1 — Document Residual/Column Scaling Deferred Work
**Current state:** ADR-052 defers residual/column scaling. Risk: solver unstability with extreme ratios or 1,000+ constraints.

**What needs doing:**
1. Open `src/sketch/solver/Solver.ts`
2. Add prominent TODO at top of file:
   ```typescript
   /**
    * TODO (ADR-052): Implement residual and column scaling for Jacobian
    * 
    * Current state: Unscaled JᵀJ + per-variable rebuilds
    * Practical limit: ~200 constraints before solver stability degrades
    * 
    * Future work (when concrete failure arises or dedicated milestone):
    * 1. Normalize residuals to [-1, 1] per variable type (mm, radians)
    * 2. Scale Jacobian columns by |∂F/∂X| magnitude
    * 3. Re-baseline solver on 1,000-constraint fixture (SolverScale.test.ts)
    * 4. Validate constraint satisfaction on mixed length+angle problems
    * 
    * Deferred because: Current alpha focuses on <200-constraint sketches.
    * Scaling changes DOF fixtures; must be done carefully to avoid hiding bugs.
    * 
    * See PROGRESS.md, docs/DECISIONS.md (ADR-052), docs/assessments.md
    */
   ```
3. Add similar note to `src/sketch/constraints/DegreesOfFreedom.ts` (rank calculation)

**Files to modify:**
- Modify: `src/sketch/solver/Solver.ts` — add TODO with acceptance criteria
- Modify: `src/sketch/constraints/DegreesOfFreedom.ts` — reference ADR-052

**Acceptance criteria:**
```
- [ ] TODO added to Solver.ts with clear deferred-work description
- [ ] Cross-reference: ADR-052, SolverScale.test.ts, PROGRESS.md
- [ ] TODO is not blocking alpha; can be skipped in code review
```

---

### 🟢 **Priority 5: Onboarding & Samples (ROADMAP #1)**

#### Issue 5.1 — Verify Sample Sketches Exist
**Current state:** README.md mentions "File → Sample: …" but unclear if `.sketch.json` samples are committed

**What needs doing:**
1. Search for sample sketch files:
   - `public/samples/*.sketch.json` (if web-served)
   - `docs/samples/*.sketch.json` (if in repo)
   - `src-tauri/data/samples/*.sketch.json` (if Tauri-bundled)
2. If none exist, create 3–5 starter sketches:
   - `bracket.sketch.json` — simple L-bracket (4 lines + H/V + distance)
   - `bolt-hole.sketch.json` — circular hole pattern (3 circles + concentric + distance)
   - `gear-outline.sketch.json` — complex polygon (regular 8-gon + fillet)
   - `slot.sketch.json` — rounded rectangle (rectangle + 2 fillets + offset)
3. Update README.md to document sample locations

**Files involved:**
- Search: `public/`, `src-tauri/`, `docs/` for existing samples
- If needed, create: `public/samples/` directory with `.sketch.json` files
- Update: `README.md` "Quick start" section with sample reference

**Acceptance criteria:**
```
- [ ] At least 3 sample sketches exist and are loadable
- [ ] Each sample includes comment: "// Created for v0.1.0-alpha.1 onboarding"
- [ ] README.md updated to reference samples
- [ ] File → Open Sample works in dev + release builds
```

---

### 🟢 **Priority 6: E2E Test Expansion (Optional Polish)**

#### Issue 6.1 — Expand Playwright E2E Coverage
**Current state:** Single smoke test (`e2e/critical-path.spec.ts`); one regression breaks all E2E

**What needs doing (future iteration):**
Create additional E2E test files (lower priority than unit tests, but useful for regression):
- `e2e/geometry-creation.spec.ts` — point, line, circle, arc, polygon, slot
- `e2e/constraints.spec.ts` — coincident, H/V, distance, angle, fix
- `e2e/editing.spec.ts` — drag, dimension edit, undo/redo, save/load
- `e2e/analysis.spec.ts` — profile detection, DOF display, over-constraint alert

**Acceptance criteria:**
```
- [ ] Each E2E file has ≥3 test cases
- [ ] All tests pass: npm run test:e2e
- [ ] Tests are fast (<30 sec total)
- [ ] No external network dependencies
```

**Note:** This is "nice to have" for v0.2.0+; not blocking alpha.

---

## Quick Reference: Files to Modify/Create

### Create (New Files)
```
CHANGELOG.md
.oxlintrc.json
.prettierrc
src/sketch/export/DxfExporter.test.ts
src/sketch/solver/SolverScale.test.ts
```

### Modify (Existing Files)
```
package.json (if TS/Node version updates needed)
src/sketch/solver/Solver.ts (add ADR-052 TODO)
src/sketch/constraints/DegreesOfFreedom.ts (add ADR-052 reference)
src/sketch/selection/SnapEngine.test.ts (expand intersection tests)
README.md (add sample sketches reference)
docs/PROGRESS.md (log test additions)
```

### Review (No changes, informational)
```
.github/workflows/*.yml (verify CI passes)
tsconfig.json (verify strict: true)
PRs #1–#6 (dependency updates)
```

---

## Testing Checklist

After completing issues above, run:
```bash
npm run typecheck              # ✓ No errors
npm run lint                   # ✓ No warnings (or documented)
npm run test                   # ✓ All unit tests pass
npm run test:e2e               # ✓ Smoke test passes
npm run build                  # ✓ Production bundle succeeds
npm run format:check           # ✓ Code formatted correctly
```

---

## Severity & Priority Guide

| Level | Meaning | Example |
|-------|---------|---------|
| 🔴 Critical | Blocking alpha readiness; fixes bugs or security issues | PR merges, missing tests, architecture violations |
| 🟡 High | Improves quality, documentation, or developer experience | Config files, CHANGELOG, sample sketches |
| 🟢 Low | Polish, future-proofing, or non-urgent enhancements | E2E expansion, UI tooltips |

---

## Questions for Clarification

Before starting work, Cursor agent should confirm:

1. **Dependency updates (PR #1–#6):** Should all be merged, or hold until manual review?
2. **Sample sketches:** Do they already exist somewhere (Figma, previous repo), or create from scratch?
3. **Solver scaling (ADR-052):** Should the baseline test be added now (non-blocking), or defer to next milestone?
4. **TypeScript strict mode:** If not enabled, is incremental adoption acceptable, or enable globally immediately?

---

## Success Metrics

✅ All Priority 1 issues resolved (dependency updates merged, CI green)  
✅ All Priority 2 issues resolved (test files created, >90% coverage on new tests)  
✅ All Priority 3 issues resolved (CHANGELOG.md, config files, documentation updated)  
✅ `npm run check` (typecheck + lint + test + build) passes with zero errors  
✅ Commit history is clean, squashed where appropriate, with clear messages  

---

## References

- **Repository:** https://github.com/guventech/WVC-CAD
- **Docs:** README.md, ARCHITECTURE.md, DECISIONS.md, PROGRESS.md, ROADMAP.md
- **Chunking system:** AGENTS.md §1–§27 (27 completed chunks)
- **Architecture decisions:** docs/DECISIONS.md (59 ADRs including ADR-052)
- **Assessment:** docs/assessments.md (post-Chunk-26 architecture review)

---

**Last Updated:** 2026-10-11  
**Prepared for:** Cursor Agent (or similar autonomous coding assistant)  
**Status:** Ready for work
