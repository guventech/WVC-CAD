# Public release checklist (before Phase 2 / public beta)

> Historical note. WVC-CAD is frozen at v0.1.0. I am not taking it to a public beta. See the project status in [README.md](../README.md).

This list was for calling a build a **public** beta. That step is withdrawn. Private alpha notes ([ALPHA.md](./ALPHA.md)) are historical too.

## License and dependencies

- [x] Application license present ([LICENSE](../LICENSE) — MIT today)
- [x] Third-party notices maintained ([THIRD_PARTY.md](../THIRD_PARTY.md))
- [ ] Re-scan `package.json` / `Cargo.toml` when adding deps; keep notices current
- [ ] Confirm public wording: only say “open source” if the chosen license still matches that claim
- [ ] Contribution terms remain clear ([CONTRIBUTING.md](../CONTRIBUTING.md)); CLA/DCO only if legal advice requires it later

## Product honesty

- [ ] README / release notes state alpha or beta quality and “not safety-critical”
- [ ] Supported vs partial vs unsupported features stay accurate
- [ ] Sample sketches and quick-start still work on a clean machine
- [ ] Bug template path works for outsiders

## Distribution

- [ ] Windows: NSIS artifact on a GitHub Release; unsigned warning documented until signing exists
- [ ] Optional: static web `dist/` hosting notes (no accounts)
- [ ] Changelog entry for the tagged version

## Explicitly later (do not block private alpha)

- Code signing / notarization
- Donation or Pro monetization
- Public product rename (keep **WVC-CAD** until brand clearance)
- Analytics, accounts, cloud

## Brand (parallel, private)

Shortlist three names and run clearance checks **locally** (see [private/README.md](../private/README.md)). Do not rename the codebase until a name is chosen and approved.
