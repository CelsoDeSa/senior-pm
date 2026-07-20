# Senior PM request examples

These examples are product inputs, not generated specifications.

## New feature

```text
@senior-pm Add a way for users to export their activity history. Inspect the repository first, define the smallest coherent export, and do not implement it.
```

## Vague request

```text
/pm-spec Make onboarding better. Ground the problem in existing entry points before asking questions, and leave unsupported design direction unresolved.
```

## UI-sensitive request

```text
/pm-spec Redesign the main dashboard so it feels specific to this product rather than like a generic SaaS dashboard. Preserve evidence-backed product patterns and require external design review for interaction or layout changes.
```

## Immutable revision

```text
/pm-revise --artifact-base activity-export.r001 Add interruption and recovery behavior for large exports without adding scheduled delivery, new formats, or an administration dashboard.
```

## Validate only

```text
/pm-validate --artifact-base activity-export.r002
```

## Manual handoff

```text
/pm-handoff --artifact-base activity-export.r002
```

## Explicit configured handoff

```text
/pm-handoff --artifact-base activity-export.r002 --target engineering-planner
```

The final example does not bypass permission. It works only when an operator configured the exact target and enabled programmatic invocation, the artifact passes fresh validation, OpenCode grants permission, and the live registry contains that agent.

## Autonomous assumptions

```text
@senior-pm Propose the smallest way for a user to resume an interrupted workflow. In autonomous mode, state every low-risk reversible assumption. Stop on security, privacy, permissions, destructive data, billing, legal, public-brand, success-definition, or irreversible decisions. Produce the specification only.
```
