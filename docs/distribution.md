# Distribution controls

This source preview candidate is not a formal release and is not published to npm.

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

No canonical source or package URL is authorized. Clone/package links are intentionally unavailable until a separately approved cutover, and inserting final URLs requires a fresh exact-tree content and security review.

See [Local validation](local-validation.md) for committed evidence-scoped results and reproducible commands. Mutable private gate reports are intentionally excluded from source and package distribution.
