# Permission and security model

Senior Product Manager combines prompt behavior, OpenCode permissions, bounded tools, descriptor-relative IO, immutable artifacts, and deterministic gates. The prompt alone is not a sandbox.

## Agent permissions

The runtime begins with a wildcard deny and preserves immutable denials after configuration merging.

| Capability | Default |
|---|---|
| Production edit/write/patch tools | Denied |
| Shell/bash | Denied |
| Task/delegation tool | Denied |
| External directories | Denied |
| Standard `read`, `glob`, `grep`, and `list` | Denied |
| `question` and `skill` | Allowed |
| Config, bounded discovery, immutable write, deterministic validation | Allowed through namespaced tools |
| Handoff | Ask |
| External approval ingestion | Ask through `senior_pm_approval_sidecar` permission |
| Web fetch/search | Denied unless an operator enables external research |

Host policy can add denials. `tool_restrictions` and `denied_permissions` cannot add allows. Project config and plugin tuple options cannot enable operator-only capabilities.

## Repository discovery

Discovery pins one root and treats all repository text as untrusted evidence. It enforces depth, file-count, per-file, total-byte, detail-path, and deadline limits. It excludes:

- VCS metadata from normal content traversal;
- dependency, vendor, generated, build, coverage, cache, output, and temporary directories;
- environment files and known credential stores;
- credential-, token-, secret-, auth-, and private-key-like names;
- binary and archive formats; and
- symlinks and out-of-root targets.

Returned excerpts redact common private keys, database URLs, AWS-style access keys, JWTs, authorization headers, API keys, client secrets, passwords, tokens, and common provider token prefixes.

Up to 20 `detail_paths` can be requested through `senior_pm_discover`. They use the same exclusions, containment, limits, and redaction. Standard read/search/list tools remain unavailable, so a model cannot bypass discovery policy for convenience.

Optional repository history is off by default and operator-only. When enabled on Linux, it pins both worktree and real `.git` directories, uses fixed `git --git-dir ... --work-tree ... log` arguments with no shell interpolation, provides a minimal sanitized environment, bounds output/time, and redacts the result.

## Linux `/proc` requirement

Secure content and mutation depend on Linux descriptor paths under `/proc/self/fd`.

On Linux, the runtime retains the repository descriptor for plugin lifetime and passes the capability through discovery, writing, approval, artifact validation, and handoff.

On non-Linux platforms:

- repository content excerpts and Git history are skipped when descriptor proof is unavailable;
- specification publication and committed-artifact validation fail closed;
- project/user installation and removal fail before modification; and
- no runtime support claim is made from path-logic unit tests.

Do not bypass these checks with a manual path rewrite.

## Specification containment

The writer accepts only the default owned root or a safe dedicated relative root ending in `senior-pm`. It rejects absolute, drive, UNC, traversal, symlink, source, config, public/static, runtime, vendor, dependency/`node_modules`, package, `dist`, build, and coverage locations. Custom roots cannot pass through `.opencode`; the fixed default is the only `.opencode` exception.

It verifies ownership and containment before publication and before each descriptor-relative file operation. Revisions use exclusive creation and never overwrite. The manifest is the last logical commit file. Validation rejects incomplete, stale, forged, mismatched, or policy-outdated sets.

Manifest-last is a logical transaction, not a physical multi-file atomic operation. Guarded rollback removes only exact bytes created by the attempted write. A changed suspicious partial file is left uncommitted rather than deleted unsafely.

## Design-review trust

The PM cannot pass a raw approval object. It can reference only an external JSON sidecar under the owned root. Ingestion is bound to path, SHA-256, spec ID, revision, and product-content hash, asks the user, and rechecks after the ask.

Limitations:

- A sidecar is not cryptographically signed.
- The permission prompt confirms ingestion of exact bytes; it does not authenticate the reviewer.
- Reviewer identity and evidence are self-asserted fields unless an external process supplies stronger provenance.
- A matching hash proves content identity, not design quality.
- Any changed product-content hash invalidates approval.

The package has no Design Critic and the PM cannot self-approve.

## Handoff authorization

Manual guidance is returned only after a committed artifact is fresh, valid, current-policy compliant, and handoff eligible. `auto` never invokes.

Programmatic invocation additionally requires an operator-configured exact target, operator-enabled capability, user `/pm-handoff` intent bound to artifact and target, an OpenCode permission decision, and fresh live registry proof. Intent is short-lived, server-side, and one-use. It is not inserted into model text.

SDK creation/prompt errors fail closed. An orphan child receives best-effort abort/delete. OMO names and standard `plan` remain advisory rather than trusted role claims.

## Installer ownership

The Linux installer:

- derives payload hashes from the currently executing package source;
- allowlists only `dist`, `assets`, `schemas`, and minimal package metadata;
- refuses preexisting wrappers or runtime trees instead of adopting them;
- creates files exclusively through pinned directories;
- writes a package-source-matched ownership manifest;
- installs a fixed-version relative wrapper;
- verifies the plugin entry and all consumed agent/command assets before import; and
- leaves unrelated OpenCode config untouched.

Cross-version trust is not assumed. A different version cannot overwrite or uninstall an existing version. The supported upgrade is matching-version verified uninstall followed by clean install.

Uninstall verifies the complete tree twice, quarantines wrapper and payload, proves active paths absent, and then commits removal. Parent identity changes, active replacements, unexpected files, modified hashes, restoration failures, and cleanup interruptions produce refusal or explicit recovery state. Removal is non-recursive and limited to individually verified owned paths.

The ownership manifest and package archive are hash-based, not publisher-signed. There is no package signature or provenance attestation in `0.1.0`.

## Current policy

Fresh artifact validation merges persisted evaluation policy with current configured additional non-goals and required sections. A stricter current policy returns `policy_outdated`, refuses handoff, and requires a new immutable revision. Project settings can tighten policy but cannot weaken the historical or operator baseline.

## Build-chain advisory

Gate D runs `npm audit --audit-level=high` and records the candidate-local result. High or critical findings block readiness. Known warnings must remain visible in the dated gate report rather than being copied from another repository's evidence.

## What the controls do not prove

- Product and repository claims are factually correct.
- An external reviewer is authentic.
- A model will always follow prose instructions.
- A downstream agent is semantically appropriate because of its ID.
- A package came from a trusted publisher without separate signing/provenance.
- An untested OpenCode, OMO, Node, kernel, filesystem, or OS combination is compatible.

Report a suspected boundary failure using [SECURITY.md](../SECURITY.md).
