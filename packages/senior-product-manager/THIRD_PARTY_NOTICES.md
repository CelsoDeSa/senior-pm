# Third-party notices

Senior PM bundles runtime code from the modules below into its generated JavaScript. The exact build metafile and Gate C report reconcile every bundled input before packaging.

| Component | Version | License | Included text |
|---|---:|---|---|
| `zod` | `3.25.76` | MIT | `LICENSES/zod-3.25.76-LICENSE` |
| `jsonc-parser` | `3.3.1` | MIT | `LICENSES/jsonc-parser-3.3.1-LICENSE.md` |
| `@opencode-ai/plugin` | `1.18.3` | MIT | `LICENSES/opencode-plugin-1.18.3-LICENSE` |
| `zod` (nested dependency of `@opencode-ai/plugin`) | `4.1.8` | MIT | `LICENSES/zod-4.1.8-LICENSE` |

The component list is evidence-scoped to the exact packed candidate. It is not a dependency-support or security guarantee. The CycloneDX document at `sbom/senior-pm.cdx.json` is the sole machine-readable SBOM.
