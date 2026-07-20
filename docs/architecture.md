# Architecture

Senior Product Manager is an OpenCode plugin with a deterministic specification core. It uses standard OpenCode extension mechanisms and isolates optional workflow hints from the core product contract.

## Component map

| Component | Responsibility |
|---|---|
| Canonical agent asset | Model-independent Senior PM role, product workflow, exact sections, and safety instructions |
| Stable plugin runtime | Load configuration, register the agent and commands, expose tools, and retain the pinned repository capability |
| Repository adapter | Return normalized, bounded, redacted context from arbitrary host repositories |
| Specification core | Validate structured product input, derive readiness, render artifacts, and publish immutable revisions |
| Design-review extension | Ingest an externally created, hash-bound approval after a user permission decision |
| Workflow adapter | List advisory candidates, produce manual guidance, or invoke one exact authorized target through the standard client |
| Installer and CLI | Install a namespaced local wrapper/runtime, validate artifacts, and perform matching-version transactional removal |

## Standard OpenCode mechanisms

The package exports a legacy-compatible standard `Plugin` function. It uses:

- the stable `config` hook to inject one subagent and four commands;
- the stable custom `tool` surface for five `senior_pm_*` tools;
- agent-level `allow`, `ask`, and `deny` permissions;
- `command.execute.before` to create short-lived server-side `/pm-handoff` intent;
- the standard client agent registry and child-session methods for optional explicit invocation; and
- local `.opencode/plugins/` or user config plugin discovery through the installer wrapper.

Commands are always registered with `agent: senior-pm` and `subtask: true`. The package does not use an experimental hook, a private OpenCode import, a TUI patch, or an Oh My OpenCode internal module.

## Runtime registration

The runtime refuses to overwrite an existing `senior-pm` agent or any existing `pm-spec`, `pm-revise`, `pm-validate`, or `pm-handoff` command. When registration succeeds, it exposes:

| Tool | Function |
|---|---|
| `senior_pm_config` | Return sanitized effective settings and capabilities |
| `senior_pm_discover` | Discover normalized repository context and up to 20 requested safe detail paths |
| `senior_pm_write_spec` | Validate structured input and publish one immutable revision |
| `senior_pm_validate_spec` | Evaluate an in-memory draft or revalidate a committed artifact set |
| `senior_pm_handoff` | Revalidate a committed artifact, then return manual guidance or attempt a permitted exact-target handoff |

The design-review permission `senior_pm_approval_sidecar` is separate from the five tools. It lets OpenCode ask the user about one exact sidecar path, digest, specification, revision, and product-content hash.

## Configuration boundary

Configuration comes from plugin-owned JSON/JSONC files, environment inputs, and optional npm tuple options. Unknown top-level OpenCode keys are not used. Later sources cannot remove mandatory sections, broaden permission rules, increase discovery limits, or let project-controlled settings authorize programmatic invocation.

See [Configuration](configuration.md) for the precedence and trust table.

## Repository boundary

The runtime resolves and pins one repository root. On Linux, descendant discovery, artifact IO, approval reads, Git metadata, and runtime tools use descriptor-relative `/proc/self/fd` paths and identity checks. Standard `read`, `glob`, `grep`, `list`, and external-directory permissions are denied; the PM requests safe detail paths through discovery instead.

Repository text is evidence, not instruction. Discovery excludes VCS metadata from normal content, dependencies, generated output, caches, binaries, environment files, credential-like names, private-key formats, and known secret stores. Excerpts are bounded and redacted.

## Specification boundary

One typed `ProductSpecInput` is the source for the exact 23 sections. Callers do not supply final status, rendered section bodies, or validation failures. The core derives them and writes:

- `<slug>.rNNN.json` — canonical evaluated specification;
- `<slug>.rNNN.md` — human-readable specification;
- `<slug>.rNNN.handoff.json` — machine-readable handoff;
- optional persisted design-review and prior-artifact records; and
- `<slug>.rNNN.manifest.json` — hashes and logical commit marker.

Publication uses exclusive files and immutable revision bases. The manifest is written last and marks the logical commit. This is not a claim of physical multi-file filesystem atomicity; validation regenerates and cross-checks the complete committed set.

## Readiness boundary

The deterministic decision table returns one of six statuses. Only `Ready for technical planning` and `Ready for implementation` are handoff eligible. Validation checks structure, meaningful content, evidence references, FR/AC/Definition-of-Done links, non-goals, vague language, interface impact, current policy, artifacts, and review lineage. It does not prove factual correctness.

UI-sensitive work uses an external design-review sidecar tied to the exact product-content hash. The PM cannot create or self-approve it. See [Specification contract](specification-contract.md).

## Workflow boundary

The default is artifact-only manual handoff. `auto` lists candidate IDs and asks a human to choose a semantically appropriate stage; it never invokes. Standard `plan` and names commonly seen in OMO-Slim or full OMO are advisory strings only.

Programmatic handoff requires all of the following:

1. A user/operator configuration sets one exact `invocation_target` and enables invocation.
2. The committed artifact passes fresh validation and is handoff eligible under current policy.
3. The user runs `/pm-handoff` with the same `--artifact-base` and `--target`.
4. OpenCode grants the `senior_pm_handoff` permission.
5. A fresh standard registry query contains the exact target.
6. Standard child-session creation and prompt calls succeed.

If any condition fails, the adapter returns refusal or manual guidance and does not silently choose another target.

## Package boundary

The package artifact allowlist contains package metadata (`package.json` and npm-added metadata), `README.md`, `LICENSE`, `THIRD_PARTY_NOTICES.md`, `LICENSES/**`, the sole `sbom/**` document, `assets/**`, `schemas/**`, and `dist/**`. The installed wrapper verifies the bundled plugin entry and consumed agent/command assets before import. The runtime itself embeds the canonical assets, so it does not reread mutable prompt files after import.

The source-preview package is private, intentionally refuses publication, and has not been published. See [Distribution](distribution.md).
