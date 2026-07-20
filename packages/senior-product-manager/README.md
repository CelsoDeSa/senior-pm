# Senior PM for OpenCode

> Public source preview. Not a formal release. Not published to npm.

Senior PM produces repository-grounded, validated product specifications without writing production code.

## Local archive evaluation

```bash
node ./dist/cli.js version
node ./dist/cli.js install --scope project --project /absolute/path/to/test-project
```

The supported package ID is `senior-pm`; the plugin and new ownership ID is `senior-pm.plugin`. The agent, commands, tools, runtime path, specification path, schema behavior, and immutable artifact semantics remain stable.

Exact legacy compatibility is limited to one frozen `0.1.0` installation fingerprint, one former owner value, and two former schema URL aliases. All other legacy shapes refuse before mutation. These identifiers are compatibility data only and do not imply affiliation with any person or organization.

## Packaged evidence

The archive includes:

- bundled runtime and declarations under `dist/`;
- canonical schemas and two frozen alias documents under `schemas/`;
- prompt and command assets under `assets/`;
- `THIRD_PARTY_NOTICES.md` and exact texts under `LICENSES/`; and
- exactly one CycloneDX SBOM under `sbom/`.

The package is marked private and intentionally refuses publication. Local packing remains available for verification.

## Runtime and verification boundary

The package declares Node.js `>=20`. The source-preview evidence records exact executed Node/npm environments rather than claiming every satisfying runtime is validated. Runtime compatibility is limited to Linux with readable `/proc/self/fd` and exact OpenCode `1.17.20` and `1.18.3`; other combinations are unvalidated.

This README is self-contained when extracted or installed globally. The canonical source location is [`CelsoDeSa/senior-pm`](https://github.com/CelsoDeSa/senior-pm). It remains private during staging, so anonymous clone/access is not available or verified until a separately authorized public-visibility check succeeds. The archive does not provide an npm publication flow.
