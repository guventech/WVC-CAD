# Sketcher

Parametric 2D mechanical sketcher (Chunks **0–27** complete). Internal units: millimetres. The sketch model is the source of truth — React is a view only.

## Scripts

```bash
npm install
npm run dev
npm run typecheck
npm run test
npm run lint
npm run build
```

## Controls

- **Select** — click to select; drag points, line ends/body, rect corners/edges, circle/arc centers or rims; Delete/Backspace to remove
- **Point** — click to place; Escape → Select
- **Line** — click start → end (L/∠); continues from the end; Escape cancels unfinished segment; perfect H/V lines get Horizontal/Vertical constraints
- **Rectangle** — opposite corners (W/H); selecting any member shows rectangle W×H; corner/edge drag stays rectangular
- **Circle** — click center → click radius (R); drag center to move; drag rim to resize
- **Arc** — center → start → end (CCW sweep; R + Sweep); drag center to move; drag arc to resize
- **Trim** — click the portion of a line to remove (needs a crossing line or world axis)
- **Extend** — click near a line end to grow to the nearest crossing line or world axis
- **Mirror** — select geometry, then click a line or world axis to copy mirrored geometry
- **Fillet** — click two lines (or adjacent rectangle edges), then click to set fillet radius
- **Chamfer** — click two lines (or adjacent rectangle edges), then click to set chamfer distance
- **Construction** — toolbar toggle creates dashed reference geometry; **Toggle Constr.** / `C` (with selection) flips selected entities
- **Coincident** — pick first point/endpoint/center, then second point or a line; partners stay together when dragged
- **Horizontal / Vertical** — click a line, or two points/endpoints/centers; stays H/V while dragging; conflicting constraints are rejected
- **Parallel / Perpendicular / Tangent / Concentric / Midpoint / Equal / Symmetric / Point on object / Fix** — constraint tools (see Constraints menu / toolbar)
- **Dimensions** — Length, H/V distance, Radius / Diameter, Angle, Offset X/Y. Edit in the Constraints panel or double-click a canvas label
- **File** — New (Ctrl+N), Open (Ctrl+O), Save (Ctrl+S); versioned `*.sketch.json`
- **Autosave** — dirty sketches autosave to a local recovery slot; restore prompt after crash/reload
- **Undo / Redo** — Ctrl+Z / Ctrl+Y (or Ctrl+Shift+Z)
- Snaps: grid, origin, endpoints/points, midpoints, centers, on-entity; temporary H/V (+ grid compose)
- Middle-drag or Alt+left-drag pans · wheel zooms around the cursor

## Windows installer (planned)

**Tauri 2** (not Electron). Details: [PACKAGING.md](./PACKAGING.md).

## Current limitations

- Three-point / tangent arcs not implemented yet
- Advanced snaps (intersection, parallel inference, etc.) not yet
- Dimension labels are text-only (no technical-drawing arrows yet)
- Playwright E2E and Windows installer are not set up yet
- Dense solver is comfortable for tens–low hundreds of constraints (see ARCHITECTURE.md)
- See [PROGRESS.md](./PROGRESS.md) and [assessments.md](./assessments.md) for deferred items

## Docs

| File | Role |
|------|------|
| [PROGRESS.md](./PROGRESS.md) | Live checklist |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Layers and edit pipeline |
| [DECISIONS.md](./DECISIONS.md) | ADRs |
| [TEST_PLAN.md](./TEST_PLAN.md) | Test coverage |
| [AGENTS.md](./AGENTS.md) | Mission and chunk plan |
| [assessments.md](./assessments.md) | Architecture assessment |
| [PACKAGING.md](./PACKAGING.md) | Tauri 2 installer plan |
