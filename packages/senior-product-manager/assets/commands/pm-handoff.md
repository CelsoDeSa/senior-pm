---
description: "Validate and prepare an approved Senior PM handoff."
agent: senior-pm
subtask: true
---

Run the user-authorized handoff flow for the committed artifact identified by an unambiguous `--artifact-base <slug.rNNN>` argument. Programmatic intent also requires `--target <exact-agent-id>`. Revalidate before every manual or explicit branch. `auto` may report candidates and manual instructions but must never invoke; an explicit configured invocation still requires OpenCode permission approval. Never create or pass design-approval data; only an externally created approval sidecar path may be referenced during specification writing.

$ARGUMENTS
