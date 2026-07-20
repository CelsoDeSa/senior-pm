# Configuration reference

Senior Product Manager uses plugin-owned JSON or JSONC. Do not add `senior_pm` as an unknown top-level key in `opencode.json`; use a plugin tuple or one of the files below.

## Minimal configuration

No configuration is required. The bundled defaults use interactive mode, model inheritance, bounded discovery, no history or external research, no programmatic invocation, mandatory design review policy, strict permissions, and `.opencode/specs/senior-pm/` output.

A safe project file at `.opencode/senior-pm.jsonc` can tighten behavior:

```jsonc
{
  "senior_pm": {
    "mode": "interactive",
    "context_limits": {
      "max_files": 100,
      "max_total_bytes": 500000,
      "timeout_ms": 2000
    },
    "additional_non_goals": [
      "Do not add a new administration dashboard."
    ],
    "tool_restrictions": ["webfetch", "websearch"],
    "denied_permissions": {
      "senior_pm_handoff": "deny"
    }
  }
}
```

See [examples/config/project-safe.jsonc](../examples/config/project-safe.jsonc).

## Sources, precedence, and trust

Later valid sources have higher ordinary precedence, but security-sensitive settings still obey trust and monotonic rules.

| Order | Source | Trust |
|---:|---|---|
| 1 | Bundled defaults | Immutable baseline |
| 2 | User `senior-pm.jsonc` or `senior-pm.json` | Operator |
| 3 | Project `.opencode/senior-pm.jsonc` or `.json` | Project |
| 4 | File named by `SENIOR_PM_CONFIG` | Operator |
| 5 | Inline `SENIOR_PM_CONFIG_JSON` | Operator |
| 6 | OpenCode plugin tuple options | Project |

For user files, JSONC wins when both `.jsonc` and `.json` exist. On Linux and macOS, the user base is `${XDG_CONFIG_HOME:-$HOME/.config}/opencode/senior-pm`; on Windows path resolution uses `%APPDATA%\opencode\senior-pm`. Secure runtime mutation is still Linux-only.

The installer honors `OPENCODE_CONFIG_DIR` for wrapper placement. The configuration loader uses the XDG/APPDATA locations above, not `OPENCODE_CONFIG_DIR`; use an environment config source when those locations intentionally differ.

`SENIOR_PM_CONFIG_JSON` wins over `SENIOR_PM_CONFIG`. Keep inline values out of shell history and logs. Neither value should contain credentials.

`SENIOR_PM_CONFIG` names a JSON/JSONC document with the same `{ "senior_pm": ... }` shape. Relative values are resolved from the OpenCode process working directory, so prefer an absolute operator-controlled path. `SENIOR_PM_CONFIG_JSON` contains the document itself; use it only through a secret-safe process environment rather than typing private product context into an interactive shell.

Project and tuple sources cannot set `invocation_target` or enable `allow_programmatic_invocation`. They cannot newly enable external research or repository history, increase context limits, remove restrictions, remove required sections/non-goals, or disable the default design gate. A project may set `allow_programmatic_invocation: false` to tighten an operator setting.

## Full field reference

### Runtime and model fields

| Field | Default | Current behavior |
|---|---|---|
| `enabled` | `true` | `false` registers no agent, commands, or tools |
| `mode` | `interactive` | Exposed to the PM as `interactive` or `autonomous`; autonomous mode still blocks high-risk decisions |
| `model` | `inherit` | `inherit` omits an agent override; another non-empty string is passed to the registered agent |
| `fallback_model` | `inherit` | Accepted adapter metadata; `0.1.0` has no standard fallback/retry implementation |
| `reasoning` | `inherit` | Accepted metadata; not passed to an active runtime adapter in `0.1.0` |
| `effort` | `inherit` | A non-`inherit` value is passed as agent effort metadata |

No provider or model is hardcoded by the package.

### Context limits

`context_limits` is merged by taking the minimum value from every source. Later sources can tighten but not increase a previous limit.

| Field | Default | Maximum accepted |
|---|---:|---:|
| `max_depth` | `6` | `20` |
| `max_files` | `200` | `10,000` |
| `max_file_bytes` | `64,000` | `1,000,000` |
| `max_total_bytes` | `1,000,000` | `10,000,000` |
| `timeout_ms` | `3,000` | `60,000` |

Discovery also limits safe detail requests to 20 paths per call. A limit result is reported as partial context rather than silently treated as complete.

### Output and specification policy

| Field | Default | Current behavior |
|---|---|---|
| `specification_directory` | `auto` | `auto` resolves to `.opencode/specs/senior-pm`; a custom value must be a dedicated relative path ending in `senior-pm` |
| `additional_non_goals` | `[]` | Additive and enforced during initial and current-policy validation |
| `required_specification_sections` | All 23 core IDs | Additive; extra IDs require matching `additionalSections` content and core IDs cannot be removed |
| `require_design_review_for_ui` | `true` | Monotonic policy marker; the bundled `true` cannot be loosened, and interface-impact rules remain mandatory |
| `product_context_files` | `[]` | Accepted reserved metadata; not an active context adapter in `0.1.0` |
| `design_context_files` | `[]` | Accepted reserved metadata; not an active design adapter in `0.1.0` |
| `product_principles` | `[]` | Accepted reserved metadata; not injected into the current agent runtime |

Custom output examples such as `product-specs/senior-pm` are valid only when every component is relative and non-symlinked. Custom paths cannot pass through source (`src`, `source`, `app`, `lib`), config, public/static, runtime, vendor, dependency/`node_modules`, `dist`, build, coverage, package, or `.opencode` segments. The final directory is plugin-owned; an existing unowned directory is refused.

The 23 core section IDs are:

```text
metadata, status, executive-summary, repository-context, target-user,
user-problem, desired-outcome, proposed-solution, smallest-shippable-slice,
user-stories, functional-requirements, acceptance-criteria,
ux-and-interface-expectations, business-rules, edge-cases,
non-functional-expectations, existing-behavior-to-preserve, non-goals,
future-considerations, dependencies-and-constraints,
risks-and-unresolved-decisions, definition-of-done, handoff-instructions
```

### Permissions and capabilities

| Field | Default | Current behavior |
|---|---|---|
| `permission_profile` | `strict` | Monotonic classification; the strict default cannot be relaxed to `restricted` |
| `tool_restrictions` | `edit`, `bash`, `task` | Additive tool names forced to `deny` |
| `denied_permissions` | `edit`, `bash`, `task` mapped to `deny` | Deny-only map; `allow` and `ask` values are rejected |
| `allow_repository_history` | `false` | Operator-only capability; enables bounded, sanitized, descriptor-backed `git log` |
| `allow_external_research` | `false` | Operator-only capability; adds `webfetch` and `websearch` permission when enabled |
| `allow_programmatic_invocation` | `false` | Operator-only capability; still requires every handoff gate |

The immutable runtime always denies production editing, shell, task, unrestricted repository reads/search/list, and external-directory access. Configuration can add denials but cannot remove these invariants.

### Handoff and adapter fields

| Field | Default | Current behavior |
|---|---|---|
| `handoff_candidates` | `[]` | Additive advisory IDs shown neutrally in manual guidance |
| `invocation_target` | unset | Operator-only exact target; does not itself authorize invocation |
| `role_mappings` | `{}` | Accepted adapter metadata; no active role-mapping adapter in `0.1.0` |
| `adapter_metadata` | `{}` | Accepted shallow string/number/boolean/list metadata; no private adapter consumes it |

Candidate names are not semantic proof. `plan`, `orchestrator`, `prometheus`, and `sisyphus` may be marked advisory, but a human still chooses a role and explicit invocation still queries the live registry.

The conceptual field `handoff_target` is not accepted by the `0.1.0` schema. Leave `invocation_target` unset for candidate-only/manual behavior; use `handoff_candidates` for hints and the operator-only `invocation_target` for one explicit programmatic target. Likewise, the earlier conceptual `read_and_specify` permission profile is not an accepted value; actual values are `strict` and `restricted`, with the bundled strict baseline remaining authoritative.

## Operator-only invocation example

Place this in the user config or an operator-controlled environment source, never project config or tuple options:

```jsonc
{
  "senior_pm": {
    "invocation_target": "engineering-planner",
    "allow_programmatic_invocation": true,
    "handoff_candidates": ["engineering-planner"]
  }
}
```

The user must still run:

```text
/pm-handoff --artifact-base activity-export.r001 --target engineering-planner
```

OpenCode then asks for the handoff permission. A model call, candidate name, repository instruction, or earlier approval is not consent.

## Plugin tuple example

Tuple options use the same document shape and project trust:

```jsonc
{
  "plugin": [
    [
      "senior-pm@0.1.0",
      {
        "senior_pm": {
          "mode": "interactive",
          "additional_non_goals": ["Do not add billing behavior."]
        }
      }
    ]
  ]
}
```

This package is not yet published. Direct Git entries are unsupported.

## Validation and errors

Configuration is strict. Unknown keys, invalid enum values, non-deny permission entries, unsafe output roots, oversized values, and malformed JSON/JSONC fail with the source name and validation path. Configuration files and inline JSON are limited to 1,000,000 bytes.

Restart OpenCode after changing any config file, environment config, or tuple option. If startup fails, use [Configuration errors](troubleshooting.md#configuration-errors).

The packaged machine-readable reference is [senior-pm-config.schema.json](../packages/senior-product-manager/schemas/senior-pm-config.schema.json). Runtime Zod validation is authoritative; representative JSON-schema parity is tested, but formal equivalence is not claimed.

Portable examples:

- [Project-safe restrictions](../examples/config/project-safe.jsonc)
- [Operator autonomous mode](../examples/config/operator-autonomous.jsonc)
- [Operator exact-target handoff](../examples/config/operator-handoff.jsonc)
