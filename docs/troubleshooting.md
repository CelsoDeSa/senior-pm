# Troubleshooting

Use the exact error and exit code before changing files. The plugin intentionally refuses ambiguous ownership, unsupported containment, stale policy, and implicit handoff.

## Installation says secure IO is unsupported

**Message:** `Installer secure IO is unsupported ... no files were modified`

The installer requires Linux `/proc/self/fd`. Do not bypass the check on macOS, Windows, or a container that hides descriptor targets. Other operating systems are unsupported by this source preview.

## Build says the runtime entry is missing

**Message:** `Built runtime entry dist/plugin.js is missing`

Build before installing:

```bash
npm run build
node packages/senior-product-manager/dist/cli.js version
```

Run the installer from the package whose `dist`, `assets`, `schemas`, and `package.json` belong together.

## Install refuses an existing wrapper or runtime tree

The installer never adopts preseeded or unverified content. Do not use a force flag; none is supported.

1. Identify the installed version under the namespaced runtime directory without modifying it.
2. Use that exact package version to run verified uninstall.
3. Resolve any cleanup/recovery result.
4. Run a clean install.

See [Upgrading and uninstalling](upgrading-and-uninstalling.md).

## A different version cannot upgrade or uninstall

Cross-version source hashes intentionally differ. Use matching-version verified uninstall, then install the new version. Recover the original tarball or checkout instead of deleting familiar paths manually.

## OpenCode does not show `senior-pm`

1. Confirm the wrapper exists at project `.opencode/plugins/senior-product-manager.js` or the user OpenCode plugin directory.
2. Confirm the matching runtime version contains `dist/plugin.js`, packaged assets, schemas, and `ownership.json`.
3. Run the matching CLI `version` command.
4. Restart OpenCode after installation or config changes.
5. Check for plugin import errors and asset integrity failures.
6. Check [Compatibility](compatibility.md) for the exact OpenCode executable.

Do not copy agent Markdown into another directory as a workaround; the runtime config hook is responsible for exact bindings and permissions.

## Agent or command collision

**Message:** `Agent collision: senior-pm` or `Command collision: ...`

The plugin refuses to overwrite host resources. Rename or remove the host-owned conflicting definition after reviewing its ownership, or do not load this plugin. Do not weaken collision checks.

## Configuration errors

Common causes:

- using YAML instead of JSON/JSONC;
- placing `senior_pm` as an unknown top-level OpenCode key instead of a plugin tuple or plugin-owned file;
- an unknown setting;
- an invalid mode or permission value;
- project/tuple config setting `invocation_target` or enabling programmatic invocation;
- an unsafe specification directory; or
- a config file over 1,000,000 bytes.

Temporarily move only the plugin-owned `senior-pm.jsonc`/`.json` out of the config path, unset `SENIOR_PM_CONFIG` and `SENIOR_PM_CONFIG_JSON`, restart OpenCode, and reintroduce one source at a time. Never print inline environment config if it may contain private product context.

## Project config cannot enable a capability

This is expected. External research, repository history, invocation authorization, and exact invocation target are operator-controlled. Put an approved setting in user config or an operator environment source. A project may still tighten it to `false` or add denials.

## Repository context is partial or empty

Inspect `missingContext`, `constraints`, and `containmentGuarantee` from `senior_pm_discover`.

Possible reasons:

- configured file, byte, depth, or deadline limit;
- no recognized docs/manifest;
- requested detail path was excluded or missing;
- sensitive, binary, generated, vendor, or symlink content was skipped;
- a file changed while being read; or
- secure descriptor-target verification is unavailable off Linux.

Do not infer missing facts. Tighten or deliberately adjust operator-approved limits only when necessary; request a safe detail path rather than enabling unrestricted read tools.

## Specification output root is refused

Use `auto` or a dedicated safe relative directory ending in `senior-pm`, such as `product-specs/senior-pm`. Do not use source, config, public/static, package, dependency/`node_modules`, runtime, vendor, `dist`, build, or coverage roots. A custom path cannot pass through `.opencode`; use `auto` for the fixed `.opencode/specs/senior-pm` root.

An existing final directory without the exact ownership marker is unowned and is not adopted. Choose a new dedicated path; do not add the marker manually.

## Specification is `Draft`

Read `validationFailures`. Typical failures include missing meaningful sections, placeholders, no non-goal, missing preserved behavior, invalid FR/AC links, non-observable criteria, missing Definition-of-Done coverage, unsupported vague language, or facts without evidence sources.

Revise product content through `/pm-revise`; never patch generated Markdown or canonical JSON.

## Specification is blocked

`Blocked by product decision` means a high-risk human decision remains. Answer the target/outcome/success, auth, permission, security, privacy, destructive data, retention, billing, legal, public-brand, major visual, or irreversible decision. Autonomous mode does not bypass it.

## Design approval is rejected

Check that:

- the sidecar is a relative JSON file under the owned output root;
- it is no larger than 64,000 bytes;
- schema version, spec ID, revision, and product-content hash match exactly;
- decision is `approved`;
- reviewer is not the PM or requester;
- reviewer fields, timestamp, and evidence are meaningful;
- OpenCode allowed `senior_pm_approval_sidecar`; and
- the file did not change after the permission prompt.

A hash from the Markdown's canonical SHA line is not the product-content hash. Use the labeled product-content hash. A revised specification requires a new review.

## Validation returns `policy_outdated`

Current configuration added a required non-goal or section after the immutable artifact was created. Create a new revision that satisfies current policy. Do not edit or reclassify the old artifact.

## Handoff is refused

Confirm the artifact is committed, fresh, current-policy compliant, and `Ready for technical planning` or `Ready for implementation`.

For explicit invocation, also confirm:

- user/operator config has the exact `invocation_target`;
- `allow_programmatic_invocation` is true in an operator source and not tightened by the project;
- `/pm-handoff` includes matching `--artifact-base` and `--target`;
- OpenCode grants the handoff permission; and
- the target appears in a fresh registry query.

If no target exists, use the manual artifact. `auto` never invokes.

## CLI validate rejects arguments

The exact syntax is:

```bash
senior-pm validate \
  --repository /absolute/path/to/repository \
  --output-root .opencode/specs/senior-pm \
  --artifact-base activity-export.r001
```

All three options are required. Options use separate key/value tokens; duplicate and unknown options are errors.

## Uninstall reports cleanup or recovery required

Exit code `1` means the request was understood but did not end in a fully clean state. Preserve the JSON output, matching package archive, config directory, and named quarantine.

- `cleanupRequired: true`, `recoveryRequired: false`: plugin is inactive, but owned quarantine cleanup did not finish.
- `recoveryRequired: true`: active-state or restoration safety is unresolved.

Do not recursively delete `.opencode`, the runtime tree, a replacement wrapper, or the quarantine. There is no broad cleanup command in `0.1.0`. Back up the config directory and request a reviewed path-specific recovery plan.

## Safe escape from a bad project configuration

If the plugin fails during project startup:

1. Stop OpenCode.
2. Preserve error output without secrets.
3. Move only `.opencode/senior-pm.jsonc` or `.json` aside.
4. Do not alter the installed wrapper/runtime.
5. Restart and verify whether the configuration error clears.
6. Correct the config against [Configuration](configuration.md).

If the wrapper itself must be removed, use matching-version verified uninstall. Manual deletion is not the safe first response.
