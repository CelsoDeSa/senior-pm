# Specification and design-review contract

Schema version `1.0.0` defines one caller-authored product input and one derived immutable artifact set. The canonical system prompt is [assets/agents/senior-pm.md](../packages/senior-product-manager/assets/agents/senior-pm.md).

## Required sections

The Markdown renderer always emits these 23 core sections in order:

1. Metadata
2. Status
3. Executive summary
4. Repository context
5. Target user
6. User problem
7. Desired outcome
8. Proposed solution
9. Smallest shippable slice
10. User stories
11. Functional requirements
12. Acceptance criteria
13. UX and interface expectations
14. Business rules
15. Edge cases
16. Non-functional expectations
17. Existing behavior to preserve
18. Non-goals
19. Future considerations
20. Dependencies and constraints
21. Risks and unresolved decisions
22. Definition of done
23. Handoff instructions

Configured additional sections follow the core sections. They cannot replace, rename, or reorder a core section.

## Statuses

| Status | Meaning | Handoff eligible |
|---|---|---|
| `Draft` | Deterministic validation failures remain | No |
| `Blocked by product decision` | At least one high-risk human decision remains | No |
| `Ready for design review` | Product scope is coherent, but required external design approval is missing | No |
| `Ready for technical planning` | Validation passed and technical planning is required | Yes, for planning |
| `Ready for implementation` | Validation passed and the input explicitly has no technical-planning gate | Yes |
| `Returned for product revision` | A validated prior ready revision now fails validation | No |

Callers cannot set final status or validation failures. The evaluator derives both. `Returned for product revision` also requires a valid same-lineage prior artifact; a caller cannot assert a previous status.

## Structured requirements

- Functional requirements use unique `FR-###` IDs.
- Acceptance criteria use unique `AC-###` IDs and reference existing FRs.
- Every FR needs at least one observable AC.
- Every AC needs exactly one explicit Definition-of-Done coverage reference.
- Confirmed facts need safe evidence references.
- Repository-claim requirements need evidence sources.
- Non-goals and preserved behavior are mandatory.
- Placeholder and vague terms fail validation in required product, evidence, provenance, review, and extension fields.

Validation is deterministic structural, lexical, reference, policy, and artifact validation. It does not establish factual truth.

## Artifact set

For a slug `activity-export` and revision `1`, the base is `activity-export.r001`. Revisions above 999 retain their full positive width.

| File | Purpose |
|---|---|
| `activity-export.r001.claim` | Exclusive internal revision claim |
| `activity-export.r001.json` | Canonical evaluated specification |
| `activity-export.r001.md` | Human-readable specification |
| `activity-export.r001.handoff.json` | Machine-readable handoff summary |
| `activity-export.r001.design-review.json` | Optional persisted copy of accepted external review bytes |
| `activity-export.r001.prior-artifact.json` | Optional persisted same-lineage prior reference |
| `activity-export.r001.manifest.json` | Hash inventory and logical commit marker, written last |

The output root also contains `.senior-pm-owned.json`. The writer refuses an existing root without the exact ownership marker and never overwrites an existing revision file.

The canonical JSON includes a product-content hash over caller-authored input. The Markdown and handoff include both relevant identities, and the manifest includes the canonical-content hash plus file hashes. Validation reloads raw files, applies runtime schemas, replays persisted approval/prior data, re-evaluates status, regenerates rendering, and compares bytes and hashes.

## Manifest-last transaction

Files are created exclusively and synced. The manifest is published last with `committed: true`; validators require it and the complete matching set. This is a logical transaction, not a physical multi-file atomic filesystem transaction. An interruption before the manifest leaves no valid committed revision, even if a suspicious uncommitted file survives guarded rollback.

## Output root

`auto` means `.opencode/specs/senior-pm`. A custom root must:

- be relative to the pinned repository;
- end in a dedicated `senior-pm` directory;
- contain no traversal, absolute, drive, or UNC path;
- contain no symlink component; and
- avoid source, config, public/static, runtime, vendor, dependency/`node_modules`, package, `dist`, build, and coverage roots; custom paths also cannot pass through `.opencode`.

The default `.opencode/specs/senior-pm` is the only custom-config-tree exception. An existing unowned final directory is not adopted.

## Interface impact and design review

The input declares one of:

- `none`
- `content_only`
- `minor_interaction`
- `substantial_ui`
- `major_visual_direction`
- fail-closed `unknown`

Minor interaction, substantial UI, major visual direction, and unknown impact require review. Content-only work requires review when it changes information hierarchy or public brand presentation.

The plugin does not include a Design Critic. A human or external design process creates a sidecar under the owned output root. The sidecar follows [senior-pm-design-review.schema.json](../packages/senior-product-manager/schemas/senior-pm-design-review.schema.json):

```json
{
  "schemaVersion": "1.0.0",
  "specId": "SPEC-42",
  "revision": 2,
  "productContentHash": "0000000000000000000000000000000000000000000000000000000000000000",
  "decision": "approved",
  "reviewer": {
    "id": "design-reviewer",
    "name": "Design Reviewer",
    "role": "Product design"
  },
  "reviewedAt": "2026-07-18T13:00:00.000Z",
  "evidence": "Reference to the approved review record"
}
```

The all-zero hash is illustrative and will not approve a real specification. Replace it with the exact product-content hash from the pending revision. The review must match spec ID and revision, have decision `approved`, identify a reviewer other than the PM/requester, and contain meaningful evidence.

When `senior_pm_write_spec` receives the relative sidecar path, it:

1. reads it beneath the owned output root using descriptor-secure IO;
2. validates schema and specification identity;
3. computes its SHA-256;
4. asks the user about that exact path/hash/spec/revision/product hash;
5. rereads and rechecks the digest after approval; and
6. copies the exact bytes into the immutable artifact set and manifest.

The permission decision authorizes ingestion, not reviewer identity. The sidecar is hash-bound but not digitally signed. Local operators must establish reviewer provenance outside the plugin. Any product-content change invalidates the approval.

## Current-policy validation

Committed artifacts preserve the policy used when they were created. Fresh validation merges that historical policy with currently configured additional non-goals and required sections. If current policy is stricter and the artifact does not satisfy it, validation returns `policy_outdated`, marks handoff ineligible, and requires a new revision. It never mutates the historical artifact.

## Schemas

- [Canonical specification](../packages/senior-product-manager/schemas/senior-pm-spec.schema.json)
- [Handoff](../packages/senior-product-manager/schemas/senior-pm-handoff.schema.json)
- [Manifest](../packages/senior-product-manager/schemas/senior-pm-manifest.schema.json)
- [Prior artifact](../packages/senior-product-manager/schemas/senior-pm-prior-artifact.schema.json)
- [Design review](../packages/senior-product-manager/schemas/senior-pm-design-review.schema.json)

Internal runtime validation is authoritative. The packaged JSON schemas receive executable representative parity tests, but formal equivalence across every bound and format is not claimed.
