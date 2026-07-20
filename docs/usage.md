# Usage

After completing this guide, you can create, revise, validate, and hand off a Senior PM specification without granting the PM production-code access.

## Invoke the agent directly

Use the standard OpenCode subagent invocation:

```text
@senior-pm Add a way for users to export their activity history.
```

The PM inspects normalized repository context before asking product questions. It may ask for a human decision when target user, outcome, success, authentication, permissions, security, privacy, destructive data behavior, billing, legal behavior, public branding, major visual direction, or an irreversible decision remains unresolved.

## Use the commands

All four commands target `senior-pm`, run as subtasks, inherit the host model unless operator configuration overrides it, and preserve `$ARGUMENTS` as the user request.

### Create a specification

```text
/pm-spec Add a way for users to export their activity history.
```

The smallest coherent slice should define who exports, which activity is in scope, the observable completion and failure behavior, compatibility and data constraints, and explicit non-goals. It should not add scheduled exports, an admin dashboard, arbitrary format configuration, or delivery integrations without a product reason.

### Revise a specification

```text
/pm-revise --artifact-base activity-export.r001 Add large-export interruption and recovery behavior without expanding the approved scope.
```

A revision is a new immutable artifact set. The PM does not patch `r001`. If the revision follows a validated prior artifact, the writer persists and checks the lineage. Any content/hash change invalidates a previous design approval.

### Validate a specification

```text
/pm-validate --artifact-base activity-export.r002
```

The command asks the PM to run deterministic validation and report status and structured failures. It does not revise or hand off the artifact.

For model-independent CLI validation:

```bash
senior-pm validate \
  --repository /absolute/path/to/host-project \
  --output-root .opencode/specs/senior-pm \
  --artifact-base activity-export.r002
```

When running from source, replace `senior-pm` with `node /absolute/path/to/senior-pm/packages/senior-product-manager/dist/cli.js`.

CLI validation exits `0` for a valid committed set, `1` for validation failure, and `2` for invalid arguments or an operational refusal. It replays persisted review/prior data and compares the immutable artifact with current configured non-goals and required sections.

### Prepare a handoff

Manual or automatic-candidate mode:

```text
/pm-handoff --artifact-base activity-export.r002
```

Explicit configured target:

```text
/pm-handoff --artifact-base activity-export.r002 --target engineering-planner
```

The artifact must pass fresh validation and be `Ready for technical planning` or `Ready for implementation`. `auto` returns neutral candidate IDs and manual instructions; it never invokes. Explicit invocation also requires matching operator configuration, a fresh registered target, the command-bound short-lived intent, and OpenCode permission approval.

Candidate-local verification covers no-target manual handoff on the exact OpenCode matrix. The interactive permission UI and a real explicit-target child session remain outside this source-preview evidence, so the explicit-target example documents the implemented contract rather than a live E2E claim.

## Vague request example

```text
/pm-spec Make onboarding better.
```

The PM should not turn this into generic onboarding screens. It first inspects the current entry points and evidence, identifies the target user and observed failure, translates “better” into an outcome, and asks only unresolved blocking questions. A safe result may remain `Blocked by product decision` when no evidence identifies the user or success definition.

## UI-sensitive example

```text
/pm-spec Redesign the main dashboard so it feels distinctive rather than like a generic SaaS dashboard.
```

The PM translates vague visual language into observable product behavior or unresolved design direction. It records product-specific patterns and clichés to avoid but does not invent a visual system. A user-visible interaction or layout change requires the external design-review path and normally becomes `Ready for design review`, not implementation-ready.

## Autonomous mode example

Set autonomous mode in an operator or project config:

```jsonc
{
  "senior_pm": {
    "mode": "autonomous"
  }
}
```

Then invoke:

```text
@senior-pm Propose the smallest way for a user to resume an interrupted workflow. Record every assumption and produce the specification only.
```

Autonomous mode can choose low-risk, reversible defaults and must list them as assumptions. It cannot assume answers for authentication, authorization, security, privacy, destructive operations, data retention, billing, legal/compliance behavior, public branding, major visual direction, central outcome, success definition, or irreversible architecture. Those remain human blockers.

## Synthetic public sample

The [synthetic public sample](../examples/synthetic-public/) is generated from fictional input and validates through the shipped CLI. It is separate from the minimum compatibility fixture.

Its status is `Ready for design review`, not implementation-ready. Handoff remains ineligible until an external design review approves this exact product-content hash:

```text
48c888ae06b0726b61f27263d9b63c02332a8ccc6b76d19f6c48f53c9609f5cf
```

The repository includes a separate [visibly synthetic sample](../examples/synthetic-public/) for artifact inspection.

## Output

The default root is:

```text
.opencode/specs/senior-pm/
```

A committed revision contains canonical JSON, Markdown, handoff JSON, a manifest, and optional persisted review/prior records. The Markdown has the exact 23 core sections. The canonical JSON is authoritative; deterministic validation regenerates the other artifacts and compares hashes.

Read [Specification contract](specification-contract.md) for statuses, filenames, review sidecars, and logical transaction behavior.

## What validation means

Validation can establish structural and lexical completeness, stable IDs, FR/AC/Definition-of-Done links, evidence references, required states, non-goals, current policy, artifact consistency, and review lineage. It cannot prove that a repository claim is true, a product choice is wise, or a human reviewer is who a JSON file says they are. Keep engineering, design, security, legal, and product review appropriate to the risk.
