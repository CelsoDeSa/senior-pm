import { writeRevision } from "../packages/senior-product-manager/dist/spec/writer.js";
import { rm } from "node:fs/promises";

const input = {
  schemaVersion: "1.0.0",
  pluginVersion: "0.1.0",
  specId: "SYNTHETIC-BOOKMARK-EXPORT",
  slug: "synthetic-bookmark-export",
  revision: 1,
  generatedAt: "2026-07-19T00:00:00.000Z",
  title: "Synthetic bookmark export",
  hostIdentifier: "synthetic-demo",
  requestedBy: "Synthetic evaluator",
  pm: { agent: "senior-pm" },
  executiveSummary:
    "Add a deliberately synthetic text export for a fictional bookmark list so the public sample can demonstrate specification structure without using private product content.",
  repositoryContext:
    "Confirmed: this sample is synthetic documentation and has no production repository claims.",
  targetUser: "A fictional reader evaluating the Senior PM artifact format.",
  userProblem:
    "The fictional reader cannot inspect a compact example of the immutable output format without generating one locally.",
  desiredOutcome:
    "The reader can inspect one clearly labeled synthetic artifact set and distinguish it from compatibility fixtures.",
  proposedSolution:
    "Document a synthetic command that exports fictional bookmark titles as plain text and reports success or an empty list.",
  smallestShippableSlice:
    "Specify only the fictional plain-text export and its success, empty, and error outcomes.",
  userStories: [
    "As a fictional reader, I want a synthetic export specification, so that I can inspect the artifact contract.",
  ],
  functionalRequirements: [
    {
      id: "FR-001",
      text: "The fictional export produces one plain-text entry per synthetic bookmark.",
    },
    {
      id: "FR-002",
      text: "The fictional export reports an empty result without creating misleading content.",
    },
  ],
  acceptanceCriteria: [
    {
      id: "AC-001",
      requirementIds: ["FR-001"],
      behavior:
        "Given two synthetic bookmarks, when export runs, then the output contains two ordered text entries.",
    },
    {
      id: "AC-002",
      requirementIds: ["FR-002"],
      behavior:
        "Given no synthetic bookmarks, when export runs, then it reports an empty result.",
    },
  ],
  uxExpectations:
    "Text-only synthetic public documentation changes; no interactive interface is introduced.",
  businessRules: ["Only synthetic bookmark titles are represented."],
  edgeCases: [
    "The fictional list is empty.",
    "The fictional write fails before completion.",
  ],
  nonFunctionalExpectations: [
    "Output is deterministic for the same synthetic input.",
  ],
  existingBehaviorToPreserve: [
    "The sample remains visibly synthetic and separate from compatibility fixtures.",
  ],
  nonGoals: [
    "No real bookmark service.",
    "No production implementation.",
    "No external publication.",
  ],
  futureConsiderations: [],
  dependenciesAndConstraints: ["This sample documents artifact behavior only."],
  definitionOfDone: [
    {
      text: "Synthetic success and empty outcomes are observable.",
      acceptanceCriteria: ["AC-001", "AC-002"],
    },
  ],
  handoffInstructions:
    "This illustrative synthetic example has no external design approval. Do not implement or hand it off.",
  evidence: {
    facts: [
      {
        statement: "The sample is intentionally synthetic.",
        sources: ["examples/synthetic-public/README.md"],
      },
    ],
    inferences: [],
    assumptions: [],
    unresolved: [],
  },
  interfaceImpact: "content_only",
  contentChangesPublicBrand: true,
  relevantStates: ["success", "empty", "error"],
  highRiskBlockers: [],
  technicalPlanningRequired: false,
};

await rm("examples/synthetic-public/senior-pm", {
  recursive: true,
  force: true,
});
const result = await writeRevision(process.cwd(), input, {
  outputRoot: "examples/synthetic-public/senior-pm",
});
console.log(
  JSON.stringify({
    base: result.base,
    productContentHash: result.spec.productContentHash,
    status: result.spec.status,
  }),
);
