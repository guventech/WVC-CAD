# Roadmap (near-term)

Public priorities only. This is **not** a promise of dates or a full business plan.

## Now / next

1. **Sample sketches** — done (`public/samples/` + File → Sample: …; validated in `SampleSketches.test.ts`).
2. **Quick-start polish** — first-run tip + README tutorial path tightened (2026-10-11).
3. **Reliability** — Playwright covers critical path, save/reopen, autosave recovery (restore/discard), malformed open, dirty-open cancel, dimension edit, first-run dismiss, status-bar resize, and sample length edit; keep expanding as users report gaps.
4. **Review remediation** — Phases 0–10 of the repo review plan landed (through final regression gate, 2026-10-12). Next alpha cut is optional; use PACKAGING release gate + CHANGELOG Unreleased.
5. **Alpha feedback** — invite a small group; triage GitHub Issues (bug template asks for version, OS, steps, expected/actual, sample file) before large features.
6. **Installer polish** — original icons landed; signed Windows builds when a certificate is available (see PACKAGING.md).

## Explicitly not current work

- Payments, accounts, cloud sync, analytics, or AI features
- 3D solids / extrusion (Pad/Pocket) until the 2D core stays solid under real use
- Renaming away from WVC-CAD (codename stays unless a cleared product name is chosen later)

Solver residual **row** scaling is **implemented** (ADR-052); column scaling is intentionally unused; engineering gates stay unscaled.
