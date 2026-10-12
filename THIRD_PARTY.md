# Third-party licenses

WVC-CAD is MIT-licensed ([LICENSE](./LICENSE)). Runtime and major tooling dependencies used to build or ship the app:

## npm (JavaScript / TypeScript)

| Package | Role | License (as published) |
|---------|------|------------------------|
| `react`, `react-dom` | UI runtime | MIT |
| `@tauri-apps/api` | Desktop bridge (loaded when running under Tauri) | Apache-2.0 OR MIT |
| `@tauri-apps/plugin-dialog` | Native open/save dialogs | Apache-2.0 OR MIT |
| `@tauri-apps/plugin-fs` | Scoped text-file read/write for Save/Open | Apache-2.0 OR MIT |
| `vite` | Bundler / dev server | MIT |
| `typescript` | Typecheck | Apache-2.0 |
| `vitest` | Unit tests | MIT |
| `@playwright/test` | E2E tests | Apache-2.0 |
| `oxlint` | Lint | MIT |
| `@vitejs/plugin-react` | Vite React plugin | MIT |
| `jsdom` | Test DOM | MIT |
| `@testing-library/*` | Component tests | MIT |
| `@tauri-apps/cli` | Desktop build CLI (dev) | Apache-2.0 OR MIT |

Browser / Vite production bundle stays algorithm-first in `src/sketch/**` with React UI. Tauri API packages are platform-gated and do not pull GPL/AGPL code.

## Cargo (Tauri shell)

| Crate | Role | License (as published) |
|-------|------|------------------------|
| `tauri` / `tauri-build` | Desktop shell | Apache-2.0 OR MIT |
| `tauri-plugin-dialog` / `tauri-plugin-fs` / `tauri-plugin-log` | Dialog, scoped FS, logging | Apache-2.0 OR MIT |
| `serde` / `serde_json` | Serialization | MIT OR Apache-2.0 |
| `log` | Logging facade | MIT OR Apache-2.0 |

Exact npm versions are pinned in [`package-lock.json`](./package-lock.json). Rust crate versions are declared in [`src-tauri/Cargo.toml`](./src-tauri/Cargo.toml) (lockfile generated on build). Re-check licenses when adding dependencies.

## Capabilities (least privilege)

Desktop FS access is limited to `$HOME`, `$DOCUMENT`, `$DESKTOP`, and `$DOWNLOAD` text files via [`src-tauri/capabilities/default.json`](./src-tauri/capabilities/default.json). No shell, HTTP, or unrestricted filesystem plugins.
