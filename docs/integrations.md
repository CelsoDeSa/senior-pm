# Integrations and handoff

Senior Product Manager remains useful with plain OpenCode, with optional OMO installations, with an existing custom planner, or with no downstream agent.

## OpenCode alone

The core depends only on standard OpenCode mechanisms:

- plugin loading;
- the stable `config` and custom-tool surfaces;
- custom agents and commands;
- agent permissions;
- command pre-execution hooks; and
- standard client registry and child-session methods.

No OMO package is required. The default handoff is a validated artifact plus manual instructions and does not invoke a target.

The candidate-local matrix exercises clean no-OMO loading and all five tools on exact OpenCode `1.17.20` and `1.18.3`. Candidate evidence, rather than historical reports, determines the source-preview verdict.

## Existing planner or orchestrator

Add known IDs as advisory candidates in project or user configuration:

```jsonc
{
  "senior_pm": {
    "handoff_candidates": ["engineering-planner", "delivery-orchestrator"]
  }
}
```

The plugin lists candidates neutrally. It does not recommend the first name or infer role semantics. A human decides whether the artifact belongs with planning, architecture, design, security review, implementation, or another stage.

For programmatic invocation, an operator must also configure one exact target in a user or environment source:

```jsonc
{
  "senior_pm": {
    "invocation_target": "engineering-planner",
    "allow_programmatic_invocation": true
  }
}
```

Then the user runs:

```text
/pm-handoff --artifact-base activity-export.r002 --target engineering-planner
```

The runtime binds a short-lived, one-use authorization to the current session, artifact base, and target. It validates the committed artifacts, checks current policy, asks permission, queries the live agent registry, creates a child session, and prompts the exact agent with the validated artifact location. A failed prompt triggers best-effort child abort/delete.

This exact-target path has unit and built-runtime coverage, but the interactive permission UI and a real child-session invocation are not part of the source-preview live matrix. Do not treat it as live E2E compatibility evidence.

## `auto` behavior

`handoff_target: auto` from the original product concept is implemented as candidate-only behavior rather than implicit invocation. In the actual `0.1.0` configuration, leaving `invocation_target` unset produces this safe default.

`auto` can:

- report registered or configured candidate IDs;
- include artifact status and hashes;
- state whether implementation may begin; and
- return manual selection instructions.

`auto` cannot:

- prove an agent's semantic role from its name;
- choose an agent for the user;
- create a child session; or
- bypass a non-ready status.

## OMO-Slim

OMO-Slim is optional and no exact OMO-Slim package compatibility claim is made by this source preview. Senior PM depends only on the standard OpenCode surfaces listed above.

An installed `orchestrator` or another Slim-provided agent may appear as a candidate because it is present in merged OpenCode agent configuration. The plugin does not import Slim, call a Slim task manager, assume its background-job semantics, install it, or change its config.

`orchestrator` is only an advisory name. The user must confirm that the installed agent is the right consumer for this specification.

## Full OMO / oh-my-openagent

Names such as `prometheus` and `sisyphus` are recognized only as advisory candidate hints. Their roles, task schemas, teams, loops, and lifecycle behavior are not standard OpenCode contracts and are not used by the core.

The package does not import full OMO internals. Full OMO was not runtime validated, so source inspection and built candidate-hint tests do not establish compatibility.

## Standard `plan`

`plan` may be a standard OpenCode agent ID in a host installation. It is still a candidate hint, not universal proof that it accepts implementation handoffs. Manual selection remains the default unless an operator explicitly configures and authorizes it.

## Custom target

Any standard registered agent can be an explicit target if:

1. an operator configures the exact ID;
2. programmatic invocation is enabled by an operator source;
3. the user runs `/pm-handoff` with matching arguments;
4. OpenCode grants permission; and
5. a fresh registry query returns that ID.

Project config and plugin tuple options cannot authorize or redirect the target.

## No downstream agent

No downstream agent is a supported state. The handoff artifact contains status, hashes, instructions, validation failures, and eligibility. A user can review the Markdown and manually give the artifact base to a trusted engineering workflow later.

The local matrix records this path independently for each exact OpenCode target. A design-gated artifact remains handoff ineligible until a matching external review exists.

Do not copy only a free-form summary and discard the canonical artifact. Downstream work should use the freshly validated revision and preserve explicit non-goals, blockers, design status, and whether implementation may begin.
