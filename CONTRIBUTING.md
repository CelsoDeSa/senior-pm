# Contributing

Thank you for improving **Senior PM for OpenCode**. Keep changes evidence-backed and narrow enough to review.

## Before you start

- Read [AGENTS.md](AGENTS.md), the relevant package README, and the architecture and security documentation.
- Open an issue or design note before changing a public ID, schema, artifact format, permission, installation layout, or trust rule.
- Do not include credentials, private repository data, personal session logs, or machine-specific auth/config files.
- Do not add a model or provider dependency to an agent's core behavior.

## Development setup

**Prerequisites:** Node.js 20 or later and npm. Secure integration and installer tests require Linux with `/proc/self/fd`.

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Run narrower suites when iterating:

```bash
npm run test:unit
npm run test:integration
```

See [docs/testing.md](docs/testing.md) for build, pack, audit, fixture, and runtime evidence gates.

## Change requirements

### Agent behavior

- Keep the system prompt model-independent and implementation-free.
- Use uniquely namespaced tools and deny-first permissions.
- Keep commands explicitly bound to their agent with subtask execution.
- Add a migration guide before a breaking public-contract change.

### Source and security

- Preserve descriptor-relative containment and fail-closed behavior.
- Treat repositories and configuration as untrusted input.
- Add tests for failure, interruption, recovery, duplicate, stale-artifact, and permission paths that the change affects.
- Do not weaken a security invariant through later configuration precedence.

### Documentation

- Describe implemented behavior, not planned behavior, as current.
- Mark unexecuted compatibility checks as pending.
- Test commands and code examples from a clean checkout.
- Link prerequisites rather than assuming reader context.

When changing Senior PM's public behavior or identity, update the project description, public-ID documentation, compatibility table, changelog, and GitHub repository description. This checklist is repeated in [README.md](README.md) and [AGENTS.md](AGENTS.md).

## Pull request checklist

- [ ] The change has focused tests or explains why no executable test applies.
- [ ] Typecheck, relevant tests, build, and pack inventory checks pass.
- [ ] Security-sensitive failures remain fail-closed.
- [ ] Public schemas, assets, examples, and docs agree.
- [ ] Compatibility claims name only executed runtimes.
- [ ] No secret, absolute workspace path, source file, test, or dependency directory enters the package.
- [ ] `CHANGELOG.md` is updated when behavior changes.

Do not publish from a contribution branch. Distribution requires the separate checklist in [docs/distribution.md](docs/distribution.md).
