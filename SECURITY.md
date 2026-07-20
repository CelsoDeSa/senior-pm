# Security policy

## Preview status

Senior PM is a private-stage public source preview candidate, not a supported release. No public vulnerability-reporting channel has been verified for outsiders while the repository remains private.

Do not place vulnerability details, credentials, exploit data, private repository content, or machine-identifying logs in a public issue or general support request. If no verified private channel is available, retain the report until the maintainer establishes one.

General usage questions are support requests, not vulnerability reports.

## High-priority boundaries

Report suspected behavior involving:

- reading outside the pinned repository or an excluded sensitive path;
- writing outside the dedicated Senior PM output root;
- production-code, dependency, deployment, or infrastructure modification by the PM;
- handoff without exact target configuration and permission;
- forged, stale, or self-approved design review acceptance;
- installer migration of anything except the frozen exact legacy `0.1.0` fingerprint; or
- removal of modified, unowned, or unrelated files.

## Post-visibility transition

If a separately authorized visibility change occurs, the owner must enable and test GitHub private vulnerability reporting from an outsider account before any announcement. Anonymous clone/install and hosted CI smoke checks must also pass.

If any check fails, the owner returns the repository to private and records that exposure occurred. Returning private cannot recall clones, caches, downloads, forks, or information already observed, and must not be described as restoring confidentiality.

Only after the outsider reporting test succeeds may this file be updated with verified GitHub reporting instructions.
