# Source-preview validation record

Record only evidence for the candidate tree under review. Do not cite another repository's history, machine-specific paths, credentials, private hosted-run identifiers, or prior package hashes.

| Field | Value |
|---|---|
| Date | `YYYY-MM-DD` |
| Candidate commit/tree | `PENDING` |
| Node/npm | `PENDING` |
| OpenCode | `1.17.20`, `1.18.3`, or `PENDING` |
| Test result | `PENDING` (record aggregate and core counts) |
| Tarball SHA-256 | `PENDING` |
| Metafile SHA-256 | `PENDING` |
| Notices SHA-256 | `PENDING` |
| SBOM SHA-256 | `PENDING` |

## Gate verdicts

- Gate A — secret/history/export: `PENDING`
- Gate B — package/publication: `PENDING`
- Gate C — bundled-license/SBOM: `PENDING`
- Gate D — dependency/metadata/link: `PENDING`

## Hosted CI and public conditions

Record hosted CI separately as `not run`, `passed`, or `failed`, with the executed OS/Node/npm matrix but without private run URLs or identifiers. A successful private hosted run is not evidence of public visibility, anonymous clone/access, public vulnerability reporting, release, or npm publication. Record those conditions as unvalidated until separately verified.
