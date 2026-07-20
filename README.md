# Senior PM for OpenCode

> **Status:** Public source preview candidate. This is not a formal release and is not published to npm.

Senior PM turns a product request into a repository-grounded, validated specification without implementing the requested feature. It uses documented OpenCode plugin surfaces and writes immutable artifacts under a dedicated Senior PM output root.

Source clone links are intentionally unavailable while no canonical candidate remote is authorized. Adding final repository URLs during a later cutover requires a fresh exact-tree content and security review.

## Supported environment

- Linux with readable `/proc/self/fd`
- Package declaration: Node.js `>=20`
- Exact local remediation environment: Node.js `22.12.0` with npm `10.9.0`
- Exact OpenCode `1.17.20` and `1.18.3` are the only runtime targets in the local validation matrix

Other Node.js, npm, OpenCode, and operating-system combinations are unvalidated unless listed in [Local validation](docs/local-validation.md). Read [Compatibility](docs/compatibility.md) before evaluating the preview.

## Stable functional IDs

| Type | ID |
|---|---|
| Package | `senior-pm` |
| Plugin and new ownership records | `senior-pm.plugin` |
| Agent | `senior-pm` |
| Commands | `pm-spec`, `pm-revise`, `pm-validate`, `pm-handoff` |
| Tools | `senior_pm_config`, `senior_pm_discover`, `senior_pm_write_spec`, `senior_pm_validate_spec`, `senior_pm_handoff` |

The legacy owner value and two legacy schema URLs are accepted only through the frozen compatibility rules documented in [Compatibility](docs/compatibility.md). Their presence does not imply affiliation with any person or organization.

## Evaluate from source

```bash
npm ci
npm test
npm run typecheck
npm run build
node packages/senior-product-manager/dist/cli.js install --scope project --project /absolute/path/to/test-project
```

Restart OpenCode after installation. The default output root is `.opencode/specs/senior-pm/` in the host project.

The package is deliberately private and its `prepublishOnly` script fails. `npm pack` is supported for local verification; npm publication is not.

Reproducible commands and public-safe result summaries are recorded in [Local validation](docs/local-validation.md). Private mutable operator reports are not shipped as project evidence.

## Documentation

- [Installation](docs/installation.md)
- [Usage](docs/usage.md)
- [Configuration](docs/configuration.md)
- [Architecture](docs/architecture.md)
- [Security model](docs/security-model.md)
- [Compatibility](docs/compatibility.md)
- [Testing](docs/testing.md)
- [Distribution controls](docs/distribution.md)
- [Synthetic public sample](examples/synthetic-public/)

## Security and support

This candidate is staged privately, so an outsider reporting flow cannot yet be verified. Read [SECURITY.md](SECURITY.md) before reporting a vulnerability. General usage questions and vulnerability reports follow different processes.

## License

Original project code is available under the [MIT License](LICENSE). Bundled-module notices and exact license texts are included in the package through `THIRD_PARTY_NOTICES.md` and `LICENSES/`.
