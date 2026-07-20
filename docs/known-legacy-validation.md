# Complete known legacy installation validation

This bounded public-safe attestation records execution against the complete known frozen legacy `0.1.0` installation represented by the shipped fingerprint. The retained source location and private operational details are intentionally omitted.

## Binding

- Shipped fingerprint SHA-256: `6d69542964764d38a8ab90180e57e37c0651456444613d34eb7dfe8739a33a6c`
- Frozen runtime inventory entries: 99
- Wrapper SHA-256 matched the shipped fingerprint: yes
- Required shape: one runtime version, zero symlinks, zero extra runtime entries

## Executed result

- The retained complete installation matched the shipped fingerprint before copying to a disposable project.
- Migration ran through the exported production `install()` path with no fingerprint override.
- The neutral installation passed verified diagnosis and retained an unrelated synthetic sentinel byte-for-byte.
- Pre-commit faults at both post-quarantine and post-neutral-install boundaries restored the complete legacy tree exactly.
- Complete-shape payload, mode, extra-entry, extra-version, and symlink mutations each refused before migration mutation and created no quarantine.

Detailed before/after inventories and hashes remain in ignored local evidence. This attestation contains no retained source path or private file content and does not authorize downgrade or any legacy shape beyond the frozen fingerprint.
