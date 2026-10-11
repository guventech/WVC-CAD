# Third-party licenses

WVC-CAD is MIT-licensed ([LICENSE](./LICENSE)). Runtime and major tooling dependencies used to build or ship the app:

| Package | Role | License (as published) |
|---------|------|------------------------|
| `react`, `react-dom` | UI runtime | MIT |
| `vite` | Bundler / dev server | MIT |
| `typescript` | Typecheck | Apache-2.0 |
| `vitest` | Unit tests | MIT |
| `@playwright/test` | E2E tests | Apache-2.0 |
| `oxlint` | Lint | MIT |
| `@vitejs/plugin-react` | Vite React plugin | MIT |
| `jsdom` | Test DOM | MIT |
| `@testing-library/*` | Component tests | MIT |
| `@tauri-apps/cli` / Tauri 2 | Desktop shell | Apache-2.0 OR MIT |

No GPL/AGPL packages are required in the production browser bundle (`react` + `react-dom` only).

Exact versions are pinned in [`package-lock.json`](./package-lock.json) and [`src-tauri/Cargo.toml`](./src-tauri/Cargo.toml). Re-check licenses when adding dependencies.
