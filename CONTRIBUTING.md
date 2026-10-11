# Contributing

Thanks for interest in this experimental 2D parametric sketcher.

## Scope

- **In scope:** 2D sketch geometry, constraints, solver honesty, diagnostics, serialization.
- **Out of scope (for now):** 3D solids, STEP/STL, assemblies, CAM, cloud sync.

Read [README.md](./README.md) and [ARCHITECTURE.md](./ARCHITECTURE.md) before large changes. Living status is in [PROGRESS.md](./PROGRESS.md). Agent/contributor roadmap details live in [AGENTS.md](./AGENTS.md).

## Dev setup

```bash
npm install
npx playwright install chromium   # once, for E2E
npm run dev
```

## Checks before a PR

```bash
npm run typecheck
npm run test
npm run lint
npm run build
npm run test:e2e   # when UI workflows change
```

## Engineering rules (short)

1. Keep CAD math in `src/sketch/**` — React is a view, not the source of truth.
2. Do not fake solver / DOF status.
3. Prefer small, tested vertical slices over broad refactors.
4. Use original UI glyphs and chrome — do not copy proprietary CAD assets.

## License

Contributions are under the MIT License ([LICENSE](./LICENSE)).
