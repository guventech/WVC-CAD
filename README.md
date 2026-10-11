# WVC-CAD

**Weekend Vibe-Coded CAD** — an experimental parametric 2D mechanical sketcher. Internal units are millimetres. The sketch model is the source of truth; React is a view only.

> Not a production CAD product. No affiliation with Autodesk, Dassault Systèmes, Siemens, PTC, or other commercial CAD vendors. Icons and chrome are original — not copied from proprietary products.

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
npm run tauri:dev    # desktop window (needs Rust + WebView2)
npm run tauri:build  # Windows NSIS/MSI installer
```

## Quick start

1. `npm run dev` and open the app.
2. Choose **Rectangle** from the shape flyout (▾), click two opposite corners.
3. Add **Distance** / **Size** dimensions from the Constraints toolbar as needed.
4. Check **Sketch Analysis** for a closed profile (“Ready for pad”).
5. **File → Save** for `.sketch.json`, or **Export DXF…** for geometry interchange.

See [ROADMAP.md](./ROADMAP.md) for near-term priorities.

## Controls

Menus: **File** | **Edit** | **Sketch** | **Constraints** | **Tools**, plus geometry/constraint toolbars.

- **Select** — click to select; drag points, line ends/body, rect corners/edges, circle/arc centers or rims; Delete/Backspace to remove
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
- **Dimensions** — Distance (smart), Size (circle ⌀ / Shift=R; arc R), Angle. Edit in the Constraints panel or double-click a canvas label
- **File** — New (Ctrl+N), Open (Ctrl+O), Save (Ctrl+S) `*.sketch.json`; **Export DXF…** (geometry-only DXF R12 ASCII)
- **Autosave** — dirty sketches autosave to a local recovery slot; restore prompt after crash/reload
- **Undo / Redo** — Ctrl+Z / Ctrl+Y (or Ctrl+Shift+Z)
- Snaps: grid, origin, endpoints/points, midpoints, centers, intersections, on-entity; temporary H/V (+ grid compose)
- Middle-drag or Alt+left-drag pans · wheel zooms around the cursor
- **Sketch Analysis** — closed profiles + “Ready for pad” topology gate (does not fake DOF)

## Windows installer

**Tauri 2** scaffold in `src-tauri/` (not Electron). Needs Rust for `tauri:dev` / `tauri:build`. Details: [PACKAGING.md](./PACKAGING.md).

## Current limitations

- Offset of mixed line+arc closed profiles falls back to single-segment / is skipped for polyline rebuild
- DXF is export-only (no import; constraints not in DXF)
- Dense solver is comfortable for tens–low hundreds of constraints (see [ARCHITECTURE.md](./ARCHITECTURE.md))
- Residual/column scaling deferred (ADR-052); see [PROGRESS.md](./PROGRESS.md) and [assessments.md](./assessments.md)
- Tauri installer requires a local Rust toolchain; app icons are still scaffold defaults

## License

MIT — see [LICENSE](./LICENSE). Third-party notices: [THIRD_PARTY.md](./THIRD_PARTY.md).

## Docs

| File | Role |
|------|------|
| [PROGRESS.md](./PROGRESS.md) | Live checklist |
| [ROADMAP.md](./ROADMAP.md) | Near-term public priorities |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Layers and edit pipeline |
| [DECISIONS.md](./DECISIONS.md) | ADRs |
| [TEST_PLAN.md](./TEST_PLAN.md) | Test coverage |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | How to contribute |
| [SECURITY.md](./SECURITY.md) | Vulnerability reporting |
| [AGENTS.md](./AGENTS.md) | Agent/contributor roadmap |
| [assessments.md](./assessments.md) | Historical architecture snapshot |
| [PACKAGING.md](./PACKAGING.md) | Tauri 2 installer notes |
| [THIRD_PARTY.md](./THIRD_PARTY.md) | Dependency licenses |
