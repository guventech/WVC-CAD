# Private alpha (Phase 1)

WVC-CAD is past the core sketcher gate for **developer** workflows and is ready for a **small private alpha** (about 10–20 people). This is **not** a public beta and **not** a monetization phase.

## Goals

- Watch people create, constrain, save, reopen, and export without hand-holding.
- Collect bugs and confusion points via [GitHub Issues](https://github.com/guventech/WVC-CAD/issues/new/choose).
- Fix reliability and onboarding before any donation or paid features.

## What to give testers

| Channel | How | Notes |
|---------|-----|--------|
| **Windows installer** | GitHub Release for the latest `v*-alpha.*` tag (NSIS `.exe`) | **Unsigned** — SmartScreen “More info → Run anyway” is expected ([PACKAGING.md](./PACKAGING.md)) |
| **Web (optional)** | `npm run build` → host or zip `dist/` | Same sketcher; Save uses browser download / local recovery (no Tauri file dialogs) |
| **From source** | Clone + `npm run dev` | Needs Node ≥ 22; see [README.md](../README.md) |

Point testers at the README quick-start and **File → Sample: Anchored rectangle**.

## Workflows to observe (acceptance for an invite)

1. Create a rectangle (or load a sample).
2. Add at least one driving dimension; edit it (double-click or Constraints panel).
3. Save `.sketch.json`, reopen, confirm geometry + constraints.
4. Export DXF once (geometry-only interchange).
5. Use Undo after a change.

If any step needs a workaround, treat it as a Phase 0/1 blocker and fix before inviting more people.

## Invite framing (honest)

- Alpha quality — not production / not safety-critical.
- Codename **WVC-CAD** until a cleared public name exists.
- No account, no payment, no cloud.
- Prefer watching a short session over only asking “do you like it?”

## Out of scope during private alpha

- Payments, donations UI, accounts, analytics, AI, cloud sync
- iOS / Android / VR packaging
- Public marketing that implies professional-grade CAD maturity

## After feedback

Triage Issues first. Only then consider public-beta readiness ([PUBLIC_RELEASE_CHECKLIST.md](./PUBLIC_RELEASE_CHECKLIST.md)).
