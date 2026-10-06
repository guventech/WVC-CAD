# Packaging — Windows desktop (target)

Goal: ship Sketcher as a **Windows installer** (`.msi` / `.exe`) that runs well on modest PCs.

## Decision: Tauri 2 (not Electron)

| | Tauri 2 | Electron |
|--|---------|----------|
| Shell | Rust + OS WebView2 | Chromium + Node |
| Typical installer | ~5–15 MB | ~80–150+ MB |
| RAM at idle | Lower | Higher |
| Fit for weak PCs | Better | Worse |

**ADR-010:** use **Tauri 2** when packaging begins. Keep the Vite/React UI as the frontend; do not put CAD math in the shell.

WebView2 is already on Windows 10/11 (or installed by the Tauri bundler). Users do not need a browser open.

## When to add Tauri

Do **not** block Chunk 5–9 on packaging. Introduce Tauri when:

1. Core sketch tools (at least line/rect/circle) are usable
2. Save/load exists (or a temporary local-file bridge is acceptable)
3. You are ready to produce a release installer

Until then: `npm run build` → static `dist/` (already ~250 KB JS gzipped ~77 KB).

## Planned layout (later)

```text
src-tauri/          # Rust shell, window, file dialogs
src/                # existing Vite/React sketcher (unchanged architecture)
dist/               # frontend build consumed by Tauri
```

Scripts (to add later):

```bash
npm run tauri dev      # desktop window + hot reload
npm run tauri build    # Windows NSIS/MSI installer under src-tauri/target/release/bundle
```

## Runtime rules that keep the app light

These are enforced in app code today; keep them when adding tools:

1. **Camera stays in the canvas** — App only receives `camera.scale` (not every pan).
2. **Memoize heavy UI** — canvas/panels skip re-render when only status chrome changes.
3. **Batch canvas strokes** — grid uses few `stroke()` calls, not one per line.
4. **No CAD math in React** — keeps the UI thin; solver stays isolated.
5. **No heavy runtime deps** — production deps are only `react` + `react-dom`. Prefer algorithms in `src/sketch/**` over libraries.
6. **Ship modern JS** — Vite `build.target: es2022` (no legacy polyfill bloat).

## Weak-PC checklist (before each release)

- [ ] Cold start feels acceptable on integrated graphics
- [ ] Pan/zoom remains smooth with ~100–500 entities
- [ ] Installer size reported and kept as small as practical
- [ ] No debug sourcemaps in release build
- [ ] WebView2 redistributable handled by the bundler

## Out of scope for packaging

- Electron
- Online-only / cloud runtime as the primary product
- Shipping `node_modules` or a Node server with the app
