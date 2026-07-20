# Upgrading and uninstalling

The installer uses package-source hashes as its external trust anchor. Removal must therefore run from the same package version and bytes that created the installation.

## Upgrade policy

Version `0.1.0` does not support automatic in-place cross-version upgrades. There is no `--force` path and no safe adoption of an existing runtime tree.

Upgrade in this order:

1. Keep or reacquire the exact currently installed package archive or source checkout.
2. Run verified uninstall with that matching version.
3. Confirm the command reports complete success.
4. Build or install the new package version.
5. Run a clean install for the same scope.
6. Restart OpenCode.

Do not run a newer CLI against an older installation and expect it to remove the old payload. Different package inventories intentionally fail verification.

## Project uninstall

Using the same source checkout or unpacked package version that installed the plugin:

```bash
PROJECT_ROOT=/absolute/path/to/matching/senior-pm
HOST_PROJECT=/absolute/path/to/host-project
node "$PROJECT_ROOT/packages/senior-product-manager/dist/cli.js" uninstall --scope project --project "$HOST_PROJECT"
```

## User uninstall

```bash
PROJECT_ROOT=/absolute/path/to/matching/senior-pm
node "$PROJECT_ROOT/packages/senior-product-manager/dist/cli.js" uninstall --scope user
```

Restart OpenCode after successful removal.

The uninstaller verifies the wrapper, complete payload inventory, hashes, ownership manifest, version, scope, parent identities, and absence of unexpected files before mutation. It preserves unrelated OpenCode files and config.

## CLI outcome and exit codes

The CLI writes a JSON result to standard output for accepted install and uninstall operations.

| Exit code | Meaning |
|---|---|
| `0` | Operation completed fully |
| `1` | The request was valid, but owned cleanup or recovery still requires attention |
| `2` | Refusal, invalid arguments, unsupported platform, integrity failure, or operational error |

A successful uninstall reports `cleanupRequired: false` and `recoveryRequired: false`. Never treat the presence of `removedVersions` alone as proof of a fully clean result.

## Pre-commit interruption

Before the uninstall commit boundary, the uninstaller quarantines the wrapper and version payload, verifies them, and proves active paths absent. If an error occurs, it tries to restore both active paths. An incomplete restoration returns:

- `cleanupRequired: true`;
- `recoveryRequired: true`;
- a named quarantine;
- a diagnostic; and
- exact restoration failures.

Do not delete the quarantine or recreate plugin paths. Preserve the JSON output and matching package archive for recovery analysis.

## Post-commit cleanup interruption

After commit, a deletion error can leave the plugin inactive with one named owned quarantine. The result reports `cleanupRequired: true`, `recoveryRequired: false`, the quarantine name, and a diagnostic.

There is no broad cleanup command in `0.1.0`. Do not run recursive removal against `.opencode`. Record the result, back up the config directory, and use a reviewed, path-specific recovery plan or report the issue privately.

## Read-only uninstall diagnostics

The package exports `diagnoseUninstall` for a matching-version inventory check. It does not modify files. From the matching project root after building:

```bash
node --input-type=module <<'NODE'
import { diagnoseUninstall } from './packages/senior-product-manager/dist/installer/index.js';

const result = await diagnoseUninstall('project', '/absolute/path/to/host-project');
console.log(JSON.stringify(result, null, 2));
NODE
```

An empty `blockers` array means the matching package recognized the installed inventory at inspection time. It is not a substitute for the uninstaller's immediate pre-mutation revalidation.

## When the matching version is unavailable

Stop. The CLI has no safe ownership proof from a different version. Do not manually remove files based only on familiar names. Recover the exact archive from the original install source, package cache, or release artifact. If that is impossible, treat removal as a manual security operation: back up the config directory, inventory every path and hash, and request review before deleting anything.
