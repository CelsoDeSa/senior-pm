# Local validation attestation

This public-safe attestation records reproducible local source-preview evidence. It is scoped to the exact source tree that contains this document and does not certify a release, publication, hosted workflow, or untested environment. Mutable operator reports remain ignored and are not part of the source or package.

## Reproduce

Run from the project root on Linux with readable `/proc/self/fd`:

```bash
npm ci
npm test
npm run typecheck
npm run build
npm run gate:a
npm run gate:b
npm run gate:c
npm run matrix:opencode
npm run gate:d
node packages/senior-product-manager/dist/cli.js validate \
  --repository . \
  --output-root examples/synthetic-public/senior-pm \
  --artifact-base synthetic-bookmark-export.r001
```

When the retained complete known installation is available locally, its separate ignored evidence can be regenerated without exposing its location:

```bash
npm run validate:known-legacy -- --source-config <retained-config-root>
```

The bounded result is recorded in [Complete known legacy installation validation](known-legacy-validation.md).

`gate:a` is the strict local fresh-root/no-remote mode. The authored workflow uses the separate `gate:a:hosted` mode with the expected checkout commit and tree. Hosted CI was not run for this source tree.

## Executed environments

| Environment | Exact result |
|---|---|
| Local remediation | Linux x64; Node.js `22.12.0`; npm `10.9.0`; Git `2.43.0` |
| Clean Node 20 | `node@sha256:8f693eaa7e0a8e71560c9a82b55fd54c2ae920a2ba5d2cde28bac7d1c01c9ba5`; Node.js `20.20.2`; npm `10.8.2` |
| OpenCode matrix | Exact npm executables `opencode-ai@1.17.20` and `opencode-ai@1.18.3` |

The package declaration remains Node.js `>=20`; that declaration is not evidence that every satisfying Node/npm pair works. Other versions and platforms are unvalidated.

## Executed results

- `npm test`: **16 test files / 177 tests passed** — 13 unit files / 147 tests, two core-integration files / 13 tests, and one built-runtime file / 17 tests.
- Focused migration/security matrix: `test/unit/installer/installer.test.ts`, **46 tests passed**, including bundled fingerprint authority, caller-override refusal, exact-fingerprint refusal, replacement races, parent replacement, quarantine injection/replacement, restoration, unrelated-file preservation, and structured post-commit cleanup recovery.
- Typecheck and build: passed locally and in the clean Node 20 environment.
- Clean Node 20 test result: **16 files / 177 tests passed**; typecheck and build passed.
- Deterministic build comparison: two clean local builds produced aggregate `dist` manifest hash `c6d194ab7a25e63f3dadaea44bfbd9c98a5057038cdb583b19f9445bd058e218`.
- Local package: `senior-pm-0.1.0.tgz`, 98 entries, 249,557 packed bytes, 1,390,083 unpacked bytes, npm shasum `0d95414103bfecdb735ba894bacada84035a6e4b`, SHA-256 `2a7fa6367ed64b7cfd5c6d68a892860eceda0fb3984af669061da1cbb758fb5e`.
- Package checks: packing passed; root and package `prepublishOnly` refused; `npm publish --dry-run` refused; packed allowlist, symlink scan, private-metadata scan, and extracted-package Markdown links passed.
- Bundled reconciliation: packed metafile, lockfile, notices, four exact license texts, and the sole CycloneDX SBOM agreed on `zod@3.25.76`, `jsonc-parser@3.3.1`, `@opencode-ai/plugin@1.18.3`, and nested `zod@4.1.8`; no unclassified bundled module was found.
- OpenCode `1.17.20` and `1.18.3`: packed install, agent/four-command/five-tool registration, config, discovery, immutable specification write, committed validation, manual handoff, uninstall, and owned-path removal passed.
- Synthetic sample: validation passed; product-content hash `67dd101d809045247705ceb397abc59d560581541ed20337226f84c7c442c517`; status `Ready for design review`; `designApproved:false`; `handoffEligible:false`.

## Warnings and limits

- `ini@7.0.0`, a transitive development dependency, declares Node `^22.22.2 || ^24.15.0 || >=26.0.0`. npm emitted `EBADENGINE` under both exact tested environments: Node `22.12.0`/npm `10.9.0` and Node `20.20.2`/npm `10.8.2`. npm's default `engine-strict=false` allowed installation, and the complete tests/typecheck/build passed. An `engine-strict=true` install is not supported by this dependency graph.
- `npm audit --audit-level=high` found zero moderate, high, or critical issues and one low-severity Windows esbuild development-server advisory in the build-only chain. The source-preview runtime does not run that development server.
- Interactive permission UI, a real explicit-target child session, other OpenCode/Node/npm versions, non-Linux secure mutation, full OMO interoperability, package signing/provenance, and public vulnerability reporting were not validated.
- External Security, Reality, Legal, Brand/content, and Oracle reviews are pending re-review for this changed tree.
- No remote, hosted CI, canonical cutover, visibility/settings change, npm publication, release, or announcement is evidenced or claimed here.

## Verification boundaries

- Gate A checks fresh-root/export/private-metadata and closed former-identifier policy across the working tree, every reachable blob/path, and commit metadata. Hosted mode accepts only the expected Actions checkout commit/tree and remote shape.
- Gate B checks private manifests, publication refusal, exact archive allowlist, tarball sanitization/symlink policy, and packed-context links.
- Gate C reconciles the exact packed metafile, lockfile, notices, licenses, and sole SBOM.
- Gate D records dependency findings, deterministic builds, schema/sample/link/CI-definition checks, and the exact local OpenCode matrix.

These results support re-running independent audits. They are not a production-readiness or public-release certification.
