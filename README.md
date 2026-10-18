# WVC-CAD

**Weekly Vibe-Coded CAD** — an experimental parametric 2D mechanical sketcher. Internal units are millimetres. The sketch model is the source of truth; React is a view only.

> Not a production CAD product. No affiliation with Autodesk, Dassault Systèmes, Siemens, PTC, or other commercial CAD vendors. Icons and chrome are original — not copied from proprietary products.

## Project status: frozen v0.1 portfolio piece

I built WVC-CAD as a parametric 2D mechanical sketcher, and I am finished with it. v0.1.0 is the last release in this repository. I am not developing it anymore. When I do more CAD work, I contribute to [tangency-labs/solidcraft](https://github.com/tangency-labs/solidcraft).

What it does:

- Parametric 2D sketches with constraints.
- A solver that checks degrees of freedom from Jacobian rank.
- Dimensions you can edit on the canvas.
- Snaps.
- Fillet, chamfer, and offset.
- DXF R12 export.
- A Tauri Windows installer.

What I learned:

- Constraint solving.
- DOF honesty via Jacobian rank.
- A command and undo architecture.
- Testing with Vitest and Playwright.
- Packaging with Tauri.

![WVC-CAD canvas](./docs/images/app-canvas.png)

To run it: Node.js 22 or newer, `npm install`, then `npm run dev`. The quick start below is the same short path.

## Prerequisites

- **Node.js ≥ 22** (see [`.nvmrc`](./.nvmrc)); `package.json` pins `packageManager` to npm 12 for lockfile reproducibility (Corepack / matching npm recommended).
- Desktop builds also need a Rust toolchain + WebView2 (see [PACKAGING.md](./docs/PACKAGING.md)).

## Scripts

```bash
npm install
npx playwright install chromium   # once, for E2E
npm run dev
npm run typecheck
npm run test
npm run test:e2e
npm run lint
npm run build
npm run check        # typecheck + lint + test + build (same as CI check job)
npm run tauri:dev    # desktop window (needs Rust + WebView2)
npm run tauri:build  # Windows NSIS installer (alpha tags; unsigned)
```

## Quick start (≈5 minutes)

1. `npm run dev` → open the app → dismiss the first-run tip (or keep it as a reminder).
2. **Fastest path:** **File → Sample: Anchored rectangle** (also under `public/samples/`).
3. **Or draw:** shape flyout (▾) → **Rectangle** → click two opposite corners.
4. **Distance** / **Size** to drive lengths; double-click a dimension (or edit in the Constraints panel).
5. Open **Sketch Analysis** — look for “Ready for pad” when the outer profile is closed.
6. **File → Save** (or **Export DXF…** for geometry-only interchange).

Other samples: filleted plate with hole, capsule slot, L-bracket, over-constrained line.

![WVC-CAD canvas](./docs/images/app-canvas.png)

### Feature status

| Area | Status |
|------|--------|
| Points, lines, circles, arcs, rectangle, polygon, slot | **Supported** |
| Fillet / trim / extend / mirror | **Supported** |
| Chamfer | **Supported** — length×angle + topology residuals (rebuild still re-seats after solve) |
| Offset | **Partial** — line / open chain / closed line+arc loop (arcs densified) / concentric circle; not exact parallel-arc offset |
| Geometric + dimensional constraints + LM solver | **Supported** |
| DOF / over-constraint honesty | **Supported** (Jacobian rank; no fake “fully constrained”) |
| Save / Save As / recent / samples / autosave | **Supported** |
| DXF | **Partial** — R12 export only (no import; constraints stay in `.sketch.json`) |
| Windows installer (Tauri 2) | **Partial** — unsigned NSIS installer |
| 3D Pad/Pocket / STEP / cloud / AI / payments | **Unsupported** |

[ROADMAP.md](./docs/ROADMAP.md) records that this repository is frozen. Full limitation list under [Current limitations](#current-limitations).

## Controls

Menus: **File** | **Edit** | **Sketch** | **Constraints** | **Tools**, plus geometry/constraint toolbars.

- **Select** — click to select; drag points, line ends/body, rect corners/edges, circle/arc centers or rims; Escape aborts an in-progress drag; Delete/Backspace to remove
- **Point** — click to place; Escape → Select
- **Line** — click start → end (L/∠); continues from the end; Escape cancels unfinished segment; perfect H/V lines get Horizontal/Vertical constraints
- **Rectangle / Polygon / Slot** — click the shape flyout (▾) to pick rectangle, N-gon, or capsule slot
- **Circle** — click center → click radius (R); drag center to move; drag rim to resize
- **Arc** — center → start → end (CCW sweep; R + Sweep); drag center to move; drag arc to resize
- **3-pt Arc** — start → through → end (circle through three points)
- **Tangent Arc** — near a line end → arc end
- **Trim** — click the portion of a line to remove (needs a crossing line or world axis)
- **Extend** — click near a line end to grow to the nearest crossing line or world axis
- **Offset** — parallel offset of a line, open chain, closed loop, or concentric circle
- **Mirror** — select geometry, then click a line or world axis; copies geometry + remappable constraints
- **Fillet** — click two lines (or adjacent rectangle edges), then click to set fillet radius
- **Chamfer** — click two lines (or adjacent rectangle edges), then click to set chamfer distance
- **Construction** — toolbar toggle creates dashed reference geometry; **Toggle Constr.** / `C` (with selection) flips selected entities
- **Coincident** — pick first point/endpoint/center, then second point or a line; partners stay together when dragged
- **Horizontal / Vertical** — click a line, or two points/endpoints/centers; stays H/V while dragging; conflicting constraints are rejected
- **Parallel / Perpendicular / Tangent / Concentric / Midpoint / Equal / Symmetric / Point on object / Fix** — constraint tools (Constraints menu / toolbar)
- **Dimensions** — Distance (smart), Size (circle ⌀ / Shift=R; arc R), Angle. Edit in the Constraints panel or double-click a canvas label; drag a label to slide the dimension set (H → up/down, V → left/right; undoable)
- **File** — New (Ctrl+N), Open (Ctrl+O), Save / Save As, Open recent, **Sample: …**, Export DXF…
- **Autosave** — dirty sketches autosave to a local recovery slot; restore prompt after crash/reload
- **Undo / Redo** — Ctrl+Z / Ctrl+Y (or Ctrl+Shift+Z)
- Snaps: grid, origin, endpoints/points, midpoints, centers, intersections, on-entity; temporary H/V (+ grid compose)
- Middle-drag or Alt+left-drag pans · wheel zooms around the cursor
- **Sketch Analysis** — closed profiles + “Ready for pad” topology gate (does not fake DOF)

## Windows installer

**Tauri 2** scaffold in `src-tauri/` (not Electron). Needs Rust for `tauri:dev` / `tauri:build`. Details: [PACKAGING.md](./docs/PACKAGING.md).

## Current limitations

Limits of this frozen v0.1.0 build, also written in [CHANGELOG.md](./CHANGELOG.md) and [PROGRESS.md](./docs/PROGRESS.md):

- **Alpha quality** — not production-ready; not suitable for safety-critical engineering
- Offset of closed line+arc profiles densifies arcs to polylines (approximate DIY; not exact parallel arcs)
- DXF is **export-only** geometry interchange (R12 ASCII; no import; constraints stay in `.sketch.json`)
- Dense solver is comfortable for tens–low hundreds of constraints (see [ARCHITECTURE.md](./docs/ARCHITECTURE.md))
- ADR-052 residual **row** scaling is in; column scaling unused
- Windows NSIS builds are **unsigned** (SmartScreen warning expected) until code signing is configured ([PACKAGING.md](./docs/PACKAGING.md))
- Reporting a bug: use [GitHub Issues](https://github.com/guventech/WVC-CAD/issues/new/choose) — include steps, expected/actual, version, OS, and a `.sketch.json` when safe
- Notes in [docs/ALPHA.md](./docs/ALPHA.md) are historical. I am not inviting testers.

## License

MIT — see [LICENSE](./LICENSE). Third-party notices: [THIRD_PARTY.md](./THIRD_PARTY.md).

## Docs

| File | Role |
|------|------|
| [PROGRESS.md](./docs/PROGRESS.md) | Live checklist |
| [ROADMAP.md](./docs/ROADMAP.md) | Frozen at v0.1.0 |
| [ALPHA.md](./docs/ALPHA.md) | Historical private-alpha notes |
| [PUBLIC_RELEASE_CHECKLIST.md](./docs/PUBLIC_RELEASE_CHECKLIST.md) | Historical checklist; no public beta |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Layers and edit pipeline |
| [DECISIONS.md](./docs/DECISIONS.md) | ADRs |
| [TEST_PLAN.md](./docs/TEST_PLAN.md) | Test coverage |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | How to contribute |
| [SECURITY.md](./SECURITY.md) | Vulnerability reporting |
| [AGENTS.md](./AGENTS.md) | Agent/contributor roadmap |
| [assessments.md](./docs/assessments.md) | Historical architecture snapshot |
| [PACKAGING.md](./docs/PACKAGING.md) | Tauri 2 installer notes |
| [THIRD_PARTY.md](./THIRD_PARTY.md) | Dependency licenses |
