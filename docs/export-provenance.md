# Export provenance

This source preview was assembled from a reviewed relative-path source export plus the remediation files listed in the inventory.

## Included classes

- Product source, tests, fixtures, schemas, prompt and command assets
- Root and package manifests plus the sole lockfile
- Public source-preview documentation and policies
- Synthetic configuration/request examples
- Candidate CI definition and local verification scripts

## Excluded classes

- All version-control metadata, refs, remotes, and prior commit ancestry
- Private operational and migration reports
- Non-candidate operational and historical validation evidence
- Prior generated roadmap/product samples
- Dependency, build, coverage, cache, credential, environment, and session directories

`export-inventory.json` maps every committed file to `reviewed-sanitized-export`, `candidate-authored`, or the inventory's self-describing entry. The reproducible sanitization command compares that map with the fresh Git index.
