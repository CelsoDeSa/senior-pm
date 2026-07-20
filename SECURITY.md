# Security policy

## Preview status

Senior PM is a public source preview, not a supported release. GitHub private vulnerability reporting is enabled, and its public report entry was verified at the public source-preview cutover.

Do not place vulnerability details, credentials, exploit data, private repository content, or machine-identifying logs in a public issue or general support request. Use the repository's Security tab to submit a private vulnerability report. If that entry is unavailable, retain the report until the maintainer establishes a verified alternative.

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

## Verified reporting boundary

GitHub private vulnerability reporting availability was verified for the public source preview. This does not establish an email address, service-level commitment, release support, or a public issue workflow for vulnerability details.
