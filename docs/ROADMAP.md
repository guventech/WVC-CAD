# Roadmap (near-term)

Public priorities only. This is **not** a promise of dates or a full business plan.

## Now / next

1. **Phase 0 core (gate met for developer use)** — geometry/constraints, undo/redo, save/load/recovery, samples, tests, alpha.4 installer. Fix only blockers that break create → constrain → save → reopen → export.
2. **Phase 1 — private alpha** — invite ~10–20 target users; observe real sessions; triage Issues. Guide: [ALPHA.md](./ALPHA.md).
3. **Alpha packaging** — unsigned Windows NSIS from GitHub Releases; optional static Web (`npm run build` → `dist/`). No mobile/VR.
4. **Parallel (non-product-code)** — brand name shortlist + clearance (local notes only under `private/`); keep codename **WVC-CAD** until chosen.
5. **Before public beta** — [PUBLIC_RELEASE_CHECKLIST.md](./PUBLIC_RELEASE_CHECKLIST.md) (license/deps already started; confirm before wide marketing).
6. **Reliability** — expand Playwright/unit coverage as alpha reports gaps.
7. **Installer polish** — signed Windows builds when a certificate is available ([PACKAGING.md](./PACKAGING.md)).

Completed recently (not the active focus): sample sketches, quick-start polish, review remediation Phases 0–10, pre-3D R1–R3 bridge (no Pad UI).

## Explicitly not current work

- Payments, donations UI, accounts, cloud sync, analytics, or AI features
- 3D solids / extrusion (Pad/Pocket) / Clipper-backed offset until the 2D core stays solid under real use
- Renaming away from WVC-CAD (codename stays unless a cleared product name is chosen later)
- iOS / Android / VR native packaging

Solver residual **row** scaling is **implemented** (ADR-052); column scaling is intentionally unused; engineering gates stay unscaled.
