# Packaging — Windows desktop (target)

Goal: ship WVC-CAD as a **Windows installer** (`.msi` / `.exe`) that runs well on modest PCs.

## Decision: Tauri 2 (not Electron)

| | Tauri 2 | Electron |
|--|---------|----------|
| Shell | Rust + OS WebView2 | Chromium + Node |
| Typical installer | ~5–15 MB | ~80–150+ MB |
| RAM at idle | Lower | Higher |
| Fit for weak PCs | Better | Worse |

**ADR-010:** use **Tauri 2** when packaging begins. Keep the Vite/React UI as the frontend; do not put CAD math in the shell.

WebView2 is already on Windows 10/11 (or installed by the Tauri bundler). Users do not need a browser open.

## Scaffold status (landed)

```text
src-tauri/          # Rust shell (Tauri 2) — window, bundle metadata
src/                # existing Vite/React sketcher (unchanged architecture)
dist/               # frontend build consumed by Tauri (`frontendDist`)
```

Scripts:

```bash
npm run tauri:dev      # desktop window + Vite hot reload (needs Rust toolchain)
npm run tauri:build    # Windows NSIS + MSI under src-tauri/target/release/bundle
```

### Prerequisites (developer machine)

1. [Rust](https://www.rust-lang.org/tools/install) (`rustc` / `cargo` on `PATH`)
2. Windows: WebView2 (usually preinstalled) + MSVC build tools if prompted by Rust
3. `npm install` (includes `@tauri-apps/cli`)

Until Rust is installed, use the web app: `npm run dev` / `npm run build`.

### Config notes

- App id: `com.wvccad.app` (`src-tauri/tauri.conf.json`)
- Bundle targets: `nsis` + `msi` (Windows installers)
- Dev URL: `http://localhost:5173` (Vite `strictPort`)
- CAD logic stays in `src/sketch/**` — the shell only hosts WebView2

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
- Native file dialogs / OS menu bridge (optional later; browser download Save works today)
