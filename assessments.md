# Architecture Assessment

**Date:** 2026-10-06  
**Scope:** Post–Chunk 26 sketcher (Chunks 0–26 + Pre–Chunk 16 World Datum Frame; Tier 1–3 geometric constraints + Fix + dimensions). Next gated work: Chunk 27 (CAD-like UI refinement).  
**Method:** Read-only code review against living docs (`PROGRESS.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `AGENTS.md`). Findings verified in source, not docs alone. Review models: Claude Opus 4.8 (thinking high) for architecture/design/constraint assessment, plus a second deep dive on geometry math and solver implementation.

**Remediation status (2026-10-06):** Prep pass implemented (ADR-045). See [PROGRESS.md](./PROGRESS.md) “Assessment remediation”. Items marked **DONE** below were addressed in code/docs; **DEFERRED** remain honest limitations.

---

## Executive verdict

The sketcher is in **genuinely good engineering health** for its stage. The domain layer (`src/sketch/**`) is cleanly isolated from React, the Levenberg–Marquardt solver reports status from residual satisfaction plus Jacobian-rank DOF (no faked “fully constrained” from dimension counts), failed edits reject without corrupting the sketch, and automated coverage is broad (~60+ test suites, including regression fixtures A–G). Docs are unusually faithful to the code. The main liabilities after remediation are **deferred numerical scaling / sign-retry**, **feature residual polymorphism**, and **exact profile arc areas** — none block Chunk 27.

---

## Strengths

- **Clean domain / React boundary.** `src/sketch/**` does not import React or `src/ui/**` — the hard rule in `ARCHITECTURE.md` holds in practice.
- **Honest solver surface.** [`Solver.ts`](src/sketch/solver/Solver.ts) diagnoses from residuals + [`DegreesOfFreedom.ts`](src/sketch/constraints/DegreesOfFreedom.ts) (Jacobian rank); status labels are text-backed, not cosmetic.
- **Signed, factored residual catalog.** [`Residuals.ts`](src/sketch/solver/Residuals.ts) captures sign/mode once per solve (`createResidualContext`); constraint families live in dedicated modules.
- **Degenerate-geometry rejection.** `geometryIsValid` in LM + loader geometric sanity on parse.
- **Reject-on-conflict contract.** Failed edits return the original sketch.
- **Defensive serialization.** Versioned `.sketch.json` with structural + geometric sanity checks.
- **Centralized geometry primitives** + shared entity queries + world datum frame.
- **Broad tests** including perf baseline and mixed length+angle DOF fixture.

---

## Improvement points

### HIGH

#### 1. Split `FilletChamferOps.ts` monolith — DONE

Split into Shared / Rebuild / LengthRestore / CornerFeatureReconcile / RectangleEdgeOps / FilletChamferApply; barrel re-exports.

#### 2. Dual constraint enforcement (LM + imperative fillet fixup) — DONE (documented + invariant)

Documented as geometry re-seating; non-null reconcile requires residual satisfaction.

#### 3. Solver scalability vs AGENTS performance targets — DONE (baseline + docs)

Perf baseline test + ARCHITECTURE practical-limit note; sparse Jacobian deferred.

#### 4. Mixed-unit Jacobian and rank-based DOF robustness — DONE (partial)

Central differences + mixed length+angle DOF fixture; nondimensional scaling **DEFERRED**.

#### 5. Latent unimplemented `distance` dimension type — DONE

Removed from model union and catalog; load rejects unknown types.

---

### MEDIUM

#### 6. Decompose `App.tsx` — DONE

Hooks: `useSketchDocument`, `useSketchAutosave`, `useSketchFileIo`.

#### 7. Feature polymorphism for residuals/drag — DEFERRED

Documented direction; rectangle/fillet still special-cased in Residuals/GeometryEdit.

#### 8. Parallel / tangent follow-which — DONE (parallel user–user)

First-picked user line anchored; datum relations unchanged. Tangent side freeze remains (with docs).

#### 9. Loader geometric sanity — DONE

#### 10. Tangent / point-on-object arc sweep — DONE (documented)

Hard sweep residual rejected valid line–arc tangents; supporting-circle behavior kept + documented. Point-on-object already has sweep penalty.

#### 11. Curve intersections — DONE (helpers)

`intersectLineCircle` / `intersectCircles` added; curve trim/fillet still later.

#### 12. `solve()` diagnoses stored geometry — DONE (docs + test)

#### 13. Chamfer rebuild-only — DONE (documented intentional)

#### 14. Frozen sign / side / mode retry — DEFERRED

Documented limitation; no automatic sign flip retry yet.

---

### LOW

#### 15. Jacobian central vs forward comment — DONE (central differences implemented)

#### 16. AGENTS folder plan vs reality — DONE (ARCHITECTURE updated)

#### 17. Silent radius clamp — DONE (comment: geometryIsValid is gate)

#### 18. Profile arc area approximation — DEFERRED

#### 19. Coincident stored-handle dual path test — DONE

---

## Before Chunk 27 vs can wait

### Completed before Chunk 27

1. Fillet ops split + re-seating docs
2. App shell hooks
3. Distance removal, perf baseline, mixed DOF fixture, loader sanity, parallel follow-bias

### Still deferred (own chunks / later)

- Residual/variable nondimensional scaling
- Sign/side mode retry on large moves
- Feature residual polymorphism interface
- Exact profile arc areas
- Curve trim/fillet using new intersection helpers
- Hard tangent arc-sweep residual (needs weighted/soft formulation)

---

## Notes

- Living status: [PROGRESS.md](./PROGRESS.md), [ARCHITECTURE.md](./ARCHITECTURE.md), [DECISIONS.md](./DECISIONS.md) ADR-045.
- This file remains an assessment snapshot with remediation annotations.
