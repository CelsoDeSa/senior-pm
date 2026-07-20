# Distribution controls

This source preview is not a formal release and is not published to npm.

## Publication refusal

- Every workspace package manifest sets `private: true`.
- `publishConfig` is absent.
- `prepublishOnly` exits non-zero intentionally.
- `npm pack` remains available for local verification.
- No release workflow, registry credential, or publication automation is included.

## Local package verification

```bash
npm ci
npm run build
npm pack ./packages/senior-product-manager --dry-run
```

The exact archive inventory must contain only declared package files. Gate B verifies publication refusal. Gate C reconciles the exact esbuild metafile, bundled modules, notices, license texts, and sole SBOM.

The canonical source location is [`CelsoDeSa/senior-pm`](https://github.com/CelsoDeSa/senior-pm). It is private during staging; anonymous clone/access is neither available nor verified until a separately authorized public-visibility check succeeds. There is no npm package URL or registry installation flow.

See [Local validation](local-validation.md) for committed evidence-scoped results and reproducible commands. Mutable private gate reports are intentionally excluded from source and package distribution.
