# Installation

After completing this guide, you will have the Senior Product Manager wrapper and versioned runtime in either one project or your user OpenCode config directory.

## Prerequisites

- Linux with a mounted and readable `/proc/self/fd`
- A Node.js version satisfying the declared package engine `>=20`
- npm
- Exact OpenCode `1.17.20` or `1.18.3` for the validated runtime matrix
- Permission to restart OpenCode after plugin or configuration changes
- An absolute path to a writable real non-symlink host-project directory for project-scoped installation

The local remediation run used exact Node.js `22.12.0` and npm `10.9.0`; a separate clean Node 20 result, when available, is recorded in [Local validation](local-validation.md). The source-preview matrix targets exact OpenCode `1.17.20` and `1.18.3`. Git is optional. Other Node.js, npm, OpenCode, and operating-system combinations remain unvalidated; see [Compatibility](compatibility.md).

## Local source development

From an existing Senior PM checkout:

```bash
npm ci
npm run typecheck
npm test
npm run build
node packages/senior-product-manager/dist/cli.js version
```

The version command must print `0.1.0`. The build creates the self-contained ESM plugin, CLI, declarations, and exported subpath modules under `packages/senior-product-manager/dist/`.

## Project installation

Set paths explicitly so you do not install into the wrong repository:

```bash
PROJECT_ROOT=/absolute/path/to/senior-pm
HOST_PROJECT=/absolute/path/to/host-project
node "$PROJECT_ROOT/packages/senior-product-manager/dist/cli.js" install --scope project --project "$HOST_PROJECT"
```

If `--project` is omitted, the CLI uses its current working directory. Explicit paths are safer in scripts.

The installer creates this owned layout:

```text
<host>/.opencode/
├── plugins/senior-product-manager.js
└── senior-pm-runtime/
    └── 0.1.0/
        ├── ownership.json
        ├── package.json
        ├── assets/
        ├── schemas/
        └── dist/
```

It does not rewrite `opencode.json`, install OMO, or copy separate agent and command resources into host-owned directories. OpenCode discovers the local JavaScript wrapper through its standard plugin directory.

Restart OpenCode after installation. From the host project, inspect the registered agent without invoking a model:

```bash
(cd "$HOST_PROJECT" && opencode debug agent senior-pm)
```

The validated output includes the `senior-pm` subagent, four bound `pm-*` commands, five namespaced tools, and deny-first permissions. If the agent is absent, use [Troubleshooting](troubleshooting.md#opencode-does-not-show-senior-pm).

## User installation

Build the package, then run:

```bash
PROJECT_ROOT=/absolute/path/to/senior-pm
node "$PROJECT_ROOT/packages/senior-product-manager/dist/cli.js" install --scope user
```

On Linux, the default user destination is `${XDG_CONFIG_HOME:-$HOME/.config}/opencode`. If `OPENCODE_CONFIG_DIR` is set, the installer uses that directory instead.

Restart every running OpenCode process after a user-scoped install. A user install makes the wrapper discoverable across projects, but each project still receives its own pinned repository boundary and specification root.

## Source checkout and local install

Direct Git references in OpenCode's `plugin` array are not a documented installation mechanism. The canonical source location is [`CelsoDeSa/senior-pm`](https://github.com/CelsoDeSa/senior-pm), but it remains private during staging; anonymous clone/access is not available or verified until a separately authorized public-visibility check succeeds. From an independently obtained reviewed checkout, build locally and use the package CLI:

```bash
cd /absolute/path/to/reviewed-senior-pm-checkout
npm ci
npm run build
node packages/senior-product-manager/dist/cli.js install --scope project --project /absolute/path/to/host-project
```

This document does not offer an anonymous clone command before public access is verified.

Keep the checkout or a matching packed tarball if you may need to uninstall this exact version later.

## Local tarball installation

You can exercise the future package shape without publishing it:

```bash
npm run build
npm pack ./packages/senior-product-manager
npm install --global ./senior-pm-0.1.0.tgz
senior-pm version
senior-pm install --scope project --project /absolute/path/to/host-project
```

The generated archive uses the neutral package name and is currently `senior-pm-0.1.0.tgz`. Confirm the filename printed by `npm pack` before running the install command. Former archive names are not active installation instructions; legacy identifiers are retained only under the frozen compatibility contract and imply no affiliation.

## npm status

The package is deliberately private and not published to npm. Evaluate it only from a reviewed local checkout or local tarball. A registry installation flow requires a separate release decision.

## After installation

1. Add optional plugin-owned configuration using [Configuration](configuration.md).
2. Restart OpenCode after every plugin or configuration change.
3. Start with the [Usage](usage.md) examples.
4. Keep the matching package version for verified removal.

For collisions, integrity errors, unsupported platforms, and recovery output, use [Troubleshooting](troubleshooting.md).

Use [Local validation](local-validation.md) for committed public-safe results and commands that regenerate private local reports.
