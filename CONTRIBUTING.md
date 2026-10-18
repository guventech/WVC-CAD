# Contributing

This repository is frozen at v0.1.0. I am not actively developing it, and I am not planning further releases. See the project status in [README.md](./README.md).

Thanks for interest in WVC-CAD, an experimental 2D parametric sketcher.

## Scope

- **In scope:** 2D sketch geometry, constraints, solver honesty, diagnostics, serialization.
- **Out of scope:** 3D solids, STEP/STL, assemblies, CAM, cloud sync, payments, accounts, analytics, AI.

Read [README.md](./README.md) and [ARCHITECTURE.md](./docs/ARCHITECTURE.md) before large changes. Living status is in [PROGRESS.md](./docs/PROGRESS.md). The roadmap is frozen: [ROADMAP.md](./docs/ROADMAP.md). Private alpha notes are historical: [docs/ALPHA.md](./docs/ALPHA.md). Agent/contributor roadmap details live in [AGENTS.md](./AGENTS.md).

Do not commit files under `private/` (gitignored local notes only — see [private/README.md](./private/README.md)).

## Dev setup

- **Node.js ≥ 22** ([`.nvmrc`](./.nvmrc)); prefer the `packageManager` npm in `package.json` (Corepack).
- Desktop: Rust + WebView2 — [PACKAGING.md](./docs/PACKAGING.md).

```bash
npm install
npx playwright install chromium   # once, for E2E
npm run dev
```

## Checks before a PR

```bash
npm run check      # typecheck + lint + test + build (matches CI)
npm run test:e2e   # when UI workflows change
```

## Engineering rules (short)

1. Keep CAD math in `src/sketch/**` — React is a view, not the source of truth.
2. Do not fake solver / DOF status.
3. Prefer small, tested vertical slices over broad refactors.
4. Use original UI glyphs and chrome — do not copy proprietary CAD assets.

## License

Contributions are under the MIT License ([LICENSE](./LICENSE)).
