# Extensibility

Extend Senior PM through its narrow public contracts, not by turning it into a general multi-agent framework.

## Existing extension points

### Additional specification policy

Organizations can add mandatory non-goals and additional section IDs through configuration. The evaluator enforces them, and current-policy validation refuses older artifacts that no longer satisfy them.

### External design review

The design-review sidecar is a versioned extension point for a human process or a future separate Design Critic package. Senior PM can ingest a matching externally created record after permission approval, but it cannot create or approve one.

### Handoff candidates and exact targets

`handoff_candidates` can list standard registered agents without coupling the core to their implementation. An operator may configure one exact invocation target. Candidate names remain advisory, and the standard registry/session capabilities remain the invocation boundary.

### Adapter metadata

`role_mappings` and `adapter_metadata` are accepted shallow configuration metadata. No active private or OMO-specific adapter consumes them in `0.1.0`. A future adapter must document its semantics, preserve manual fallback, and remain optional.

### Core package exports

The package exposes documented subpaths for core, config, repository, specification, validation, and installer modules. Treat schemas and artifact formats as versioned public contracts. Do not import internal `dist/*` implementation paths from another package.

## Future reviews and policy extensions

Separately approved work could add integrations for:

- Design Critic review;
- security review;
- legal/compliance review;
- domain-specific PM profiles;
- organization product principles;
- custom specification templates;
- alternative renderers; and
- additional handoff adapters.

None of these integrations is implemented in `0.1.0`, and this repository does not reserve scaffolding for additional agents.

## Requirements for a future Design Critic

A separate critic should:

1. Receive the immutable specification and product-content hash.
2. Have no ability to alter the Senior PM artifact set.
3. Produce the public design-review schema or a separately versioned successor.
4. Identify the reviewer and evidence source.
5. Require user/operator-controlled placement and ingestion permission.
6. Never let Senior PM act as reviewer.

If cryptographic reviewer identity is required, introduce signing and trust-root policy as a new contract. Do not imply that current hashes provide signatures.

## Requirements for future workflow adapters

- Use documented standard OpenCode capabilities or a clearly optional public API.
- Do not import OMO private internals.
- Detect capabilities; do not infer semantics from names alone.
- Keep `auto` non-invoking unless a future breaking policy explicitly changes with user consent.
- Preserve exact-target operator configuration, fresh readiness, permission approval, and manual fallback.
- Fail closed when registry, session, or cleanup calls fail.

## Requirements for alternative templates and renderers

- Preserve canonical JSON as the source of truth.
- Preserve all 23 core sections and stable IDs unless a new schema major version and migration guide authorize a break.
- Keep deterministic normalization, hashes, immutable revisions, and manifest cross-checks.
- Escape headings and control characters.
- Keep machine and human artifacts tied to the same canonical content.

## Scope boundary

Adding another agent, host adapter, or package is outside Senior PM `0.1.0`. Such work requires a separate specification, compatibility analysis, and executed runtime evidence; it must not be inferred from Senior PM's current support matrix.
