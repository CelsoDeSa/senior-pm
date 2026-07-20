# Compatibility

## Runtime boundary

Source-preview validation targets exact OpenCode `1.17.20` and `1.18.3` on Linux with readable `/proc/self/fd` and writable real non-symlink project directories. Local and private hosted execution are recorded in [Local validation](local-validation.md); Git is optional. Other versions and operating systems are unvalidated.

## Stable IDs

The agent remains `senior-pm`; commands remain `pm-spec`, `pm-revise`, `pm-validate`, and `pm-handoff`; the five tools remain `senior_pm_config`, `senior_pm_discover`, `senior_pm_write_spec`, `senior_pm_validate_spec`, and `senior_pm_handoff`.

## Ownership marker contract

- New roots write exact owner `senior-pm.plugin`.
- Existing roots with exact legacy owner `elon-musk-agents.senior-product-manager` remain unchanged.
- Validation accepts exactly those two complete UTF-8 marker documents and rejects every missing, normalized, mixed, altered, or additional value.

The legacy string is a frozen compatibility value and carries no affiliation claim.

## Schema contract

Canonical IDs:

- `urn:senior-pm:schema:spec:1.0.0`
- `urn:senior-pm:schema:design-review:1.0.0`

Exactly two alias documents retain the frozen legacy URLs for byte-level compatibility. Config, handoff, manifest, and prior-artifact schemas remain id-less.

## Installer migration

Only one known legacy `0.1.0` installation fingerprint is eligible. Matching covers the wrapper, ownership manifest, reduced package manifest, every payload byte, complete inventory, entry type, mode, sole runtime version, zero symlinks, and zero extra runtime entries.

Production `install()` always loads that bundled fingerprint and verifies its pinned SHA-256 before use. Callers cannot select or inject another fingerprint. Reduced synthetic fingerprints are exercised only by internal source tests and are unavailable through the exported installer API. The complete shipped shape was also executed through the production path; see [Complete known legacy installation validation](known-legacy-validation.md).

Every difference or unknown version refuses before quarantine. An exact match is handled through Linux no-follow descriptor-pinned config, plugin, runtime, version, and quarantine directories. Parent and target identities are rechecked around moves; the complete frozen fingerprint is revalidated inside quarantine before neutral installation commits.

Pre-commit failure restores exact legacy bytes and modes when the verified destinations remain safe. Replacement, injection, or identity mismatch preserves quarantine and returns structured recovery state rather than deleting uncertain content. Post-commit cleanup deletes only individually identity/hash-verified expected files and prunes verified empty directories; cleanup failure returns `cleanupRequired` and, for unsafe identity/inventory states, `recoveryRequired`. Unrelated files remain outside the migration inventory. Post-success downgrade and every non-frozen legacy shape are unsupported.
