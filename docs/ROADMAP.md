# Roadmap (near-term)

Public priorities only. This is **not** a promise of dates or a full business plan.

## Now / next

1. **Sample sketches** — done (`public/samples/` + File → Sample: …).
2. **Quick-start polish** — first-run tip + README tutorial path tightened (2026-10-11).
3. **Reliability** — Playwright covers critical path, save/reopen, autosave recovery, malformed open, dimension edit, first-run dismiss, status-bar resize, and sample length edit; keep expanding as users report gaps.
4. **Alpha feedback** — invite a small group; triage GitHub Issues before large features.
5. **Installer polish** — original icons landed; signed Windows builds when a certificate is available (see PACKAGING.md).

## Explicitly not current work

- Payments, accounts, cloud sync, analytics, or AI features
- 3D solids / extrusion (Pad/Pocket) until the 2D core stays solid under real use
- Renaming away from WVC-CAD (codename stays unless a cleared product name is chosen later)

Solver residual **row** scaling is **implemented** (ADR-052); column scaling is intentionally unused; engineering gates stay unscaled.
