# Testing and verification

Run commands from the Senior PM project root unless a section says otherwise.

## Clean setup

```bash
npm ci
```

Do not use production credentials or a real private repository as a fixture. Tests should create temporary homes and synthetic repositories.

## Portable test gate

The complete local gate runs the build-free unit suite, performs one clean build, then runs both core integration files and the built-runtime integration file. Focused core and runtime integration scripts each perform their own clean build before consuming `dist`:

```bash
npm test
```

For file-handle and cleanup diagnostics:

```bash
NODE_OPTIONS=--trace-warnings npm test
```

Record the file and test count printed by the exact candidate. Do not carry a count from another history or package.

Run only unit tests with `npm run test:unit`, or both integration suites with `npm run test:integration`.

## Integration suites

Run core/process fixtures:

```bash
npm run test:integration:core --workspace senior-pm
```

Run built runtime, pack, and installer integration:

```bash
npm run test:integration:runtime --workspace senior-pm
```

Run every discovered test:

```bash
npx vitest run --config vitest.config.ts
```

Linux-only cases intentionally skip or fail closed elsewhere. A skipped secure-IO test is not cross-platform support evidence.

## Typecheck and build

```bash
npm run typecheck
npm run build
```

The build removes package-owned `dist`, compiles declarations/subpath modules, bundles `dist/plugin.js` and executable `dist/cli.js` as ESM targeting Node 20 syntax, embeds Markdown assets, and normalizes built-in imports to `node:`. This build target is not a claim that every Node 20 or later runtime has been tested; exact executed environments are listed in [Local validation](local-validation.md).

Run the built CLI smoke:

```bash
node packages/senior-product-manager/dist/cli.js version
```

It must print the package version and exit `0`.

## Package inventory

Preview the archive:

```bash
npm pack ./packages/senior-product-manager --dry-run
```

Create a relocatable archive in a temporary directory:

```bash
mkdir -p /tmp/senior-pm-pack
npm pack ./packages/senior-product-manager --pack-destination /tmp/senior-pm-pack
```

The package may contain only npm-added metadata, the package manifest, README, LICENSE, `THIRD_PARTY_NOTICES.md`, `LICENSES/**`, the sole `sbom/**` document, `dist/**`, `assets/**`, and `schemas/**`. Reject source, tests, scripts, `node_modules`, credentials, auth stores, session logs, absolute workspace paths, symlinks, or stale build chunks.

Build twice from clean output and compare inventories and hashes before release. Record both command results rather than stating “deterministic” without byte evidence.

## Dependency audit

```bash
npm audit --audit-level=high
```

High or critical findings block source-preview readiness. Gate D records lower-severity findings without hiding them.

Record Node engine warnings and the exact audit disposition in Gate D for this candidate.

## Portable fixtures

| Fixture | Ecosystem | Purpose |
|---|---|---|
| `web-catalog` | Dependency-free JavaScript/web | Documentation, UI paths, tests, manifest, and host agent instructions |
| `python-weather` | Python API | Structurally unrelated backend/API discovery |
| `go-renamer` | Go CLI | Non-web command-line discovery and process publication |
| `minimal` | No recognized manifest/docs | Missing-context behavior |

Fixture integration must hash source trees before and after. Only the copied fixture's plugin-owned specification root may change during publication, and canonical fixture sources must remain byte-identical.

## Security and adversarial coverage

Relevant suites should cover:

- hostile project and tuple config;
- symlinks, traversal, absolute/drive/UNC paths, forbidden roots, and root replacement;
- sensitive paths, binaries, generated/vendor content, redaction, and limits;
- cross-process revision collision and manifest-last behavior;
- stale/forged/replaced/self-approved design review;
- malformed or mismatched artifact sidecars and prior lineage;
- policy tightening after artifact creation;
- deny-first permission ordering and collision refusal;
- candidate-only `auto` behavior and exact target/nonce/registry gates;
- interrupted install, payload/asset tamper, matching removal, quarantine, restoration, parent replacement, and unrelated-file preservation; and
- representative runtime-Zod/JSON-schema parity.

## Executed OpenCode runtime validation

The source-preview gate must exercise the relocated packed plugin on exact OpenCode `1.17.20` and `1.18.3`. Record registration, five-tool visibility, specification/validation, install, and removal outcomes in private local or hosted evidence, then publish only a sanitized result summary such as [Local validation](local-validation.md); do not reuse another repository's result or private hosted identifiers.

No OMO runtime compatibility is claimed by the source-preview candidate. OMO-like names remain advisory test fixtures only.

Actual runtime inspection proved `senior_pm_handoff` and `senior_pm_approval_sidecar` are `ask`, and a restrictive host policy changed handoff to deny/disabled. The interactive permission UI and a real explicit-target child session were not exercised. Unit and built-runtime tests cover the optional target, nonce, registry, SDK-error, and cleanup paths, but they are not live E2E evidence.

Determine syntax from each executable and record exact sanitized commands and outcomes rather than publishing guessed invocations.

## Verification matrix

The release evidence uses IDs V-01 through V-14:

| ID | Evidence |
|---|---|
| V-01 | Clean built/packed/relocated load and registered IDs without global OMO |
| V-02 | Command binding and deny-first permission order |
| V-03 | Project/tuple trust cannot widen sensitive capabilities |
| V-04 | Path, symlink, root, extension, and race containment |
| V-05 | Exclusive immutable publication and no-clobber behavior |
| V-06 | Process-level deterministic rendering |
| V-07 | Review and artifact forgery/staleness refusal |
| V-08 | Candidate-only auto and explicit invocation gates |
| V-09 | Fixture before/after hash confinement |
| V-10 | Transactional install/uninstall/relocation/recovery |
| V-11 | Four unrelated discovery fixtures |
| V-12 | Exact sections, labels, IDs, readiness, and handoff eligibility |
| V-13 | Visibly synthetic public sample and independent content disposition |
| V-14 | Exact versions, commands, results, hashes, compatibility, and file inventory |

Use [validation-report-template.md](validation-report-template.md) for private local evidence and [Local validation](local-validation.md) for committed public-safe evidence. A generic “all tests passed” statement does not close a matrix item.
