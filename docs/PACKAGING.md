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
- Bundle targets: **NSIS only** for alpha (`0.1.0-alpha.3`). WiX/MSI rejects non-numeric prerelease labels like `alpha`; re-enable `"msi"` when the version is MSI-safe (e.g. `0.1.0` or `0.1.0-1`).
- Dev URL: `http://localhost:5173` (Vite `strictPort`)
- CSP: production WebView CSP in `tauri.conf.json` (no cloud `connect-src`); web `index.html` meta allows `ws:`/`wss:` for Vite HMR only
- Icons: original mark from `branding/icon-source.png` via `npx tauri icon`
- Capabilities: `dialog` + scoped `fs` only (no shell / HTTP plugins)
- CAD logic stays in `src/sketch/**` — the shell only hosts WebView2

### Windows code signing (plan)

Unsigned NSIS/MSI builds trigger SmartScreen warnings. For alpha:

1. Ship **unsigned** installers from the `tauri-build` tag workflow and document the warning in release notes.
2. Before a public beta, obtain a standard code-signing certificate (OV or EV) and sign with `signtool` / Tauri bundle signing env vars in CI secrets.
3. Prefer EV + Trusted Signing / Azure for fewer SmartScreen prompts once volume exists.
4. Never commit certificates or private keys to the repo.

Until signing lands, users can still run the installer by choosing “More info → Run anyway” on SmartScreen.

### Release gate (before tagging `v*`)

1. `main` CI green: `typecheck · lint · test · build` and Playwright E2E (tag builds do not re-run the full web CI job).
2. Push the commit that loosens solver timing ceilings (`SolverPerformance` / `SolverScale`) — older tags failed GHA on 5s/15s budgets.
3. `npm run check` locally on the release commit; Node ≥ 22 matching `.nvmrc`.
4. Tag `vX.Y.Z-alpha.N` → `Tauri build (Windows)` uploads NSIS under `windows-installers` and attaches to the GitHub Release.
5. Release notes must state: **unsigned installer**, DXF export-only, alpha quality — not production / not safety-critical.
6. Confirm [`THIRD_PARTY.md`](../THIRD_PARTY.md) matches current `package.json` / `Cargo.toml` deps.

## Runtime rules that keep the app light

These are enforced in app code today; keep them when adding tools:

1. **Camera stays in the canvas** — App only receives `camera.scale` (not every pan).
2. **Memoize heavy UI** — canvas/panels skip re-render when only status chrome changes.
3. **Batch canvas strokes** — grid uses few `stroke()` calls, not one per line.
4. **No CAD math in React** — keeps the UI thin; solver stays isolated.
5. **Thin runtime deps** — web CAD core stays algorithm-first in `src/sketch/**`; allowed extras are React and Tauri plugins loaded only behind platform detection (ADR-058).
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
- Native Save/Open via Tauri dialog + fs plugins (ADR-058); web uses File System Access API or download fallback
