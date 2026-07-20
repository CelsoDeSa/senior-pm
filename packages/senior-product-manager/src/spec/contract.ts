export const SCHEMA_VERSION = "1.0.0" as const;
export { SPEC_FORMATS, SPEC_LIMITS, PLACEHOLDER_PATTERN, isMeaningfulContent } from "./limits.js";
export const SPEC_SCHEMA_ID = "urn:senior-pm:schema:spec:1.0.0";
export const DESIGN_REVIEW_SCHEMA_ID = "urn:senior-pm:schema:design-review:1.0.0";
export const LEGACY_SPEC_SCHEMA_ID = "https://github.com/CelsoDeSa/elon-musk-agents/schemas/senior-pm-spec.schema.json";
export const LEGACY_DESIGN_REVIEW_SCHEMA_ID = "https://github.com/CelsoDeSa/elon-musk-agents/schemas/senior-pm-design-review.schema.json";
export const SECTION_DEFINITIONS = [
  ["metadata", "Metadata"], ["status", "Status"], ["executive-summary", "Executive summary"], ["repository-context", "Repository context"], ["target-user", "Target user"], ["user-problem", "User problem"], ["desired-outcome", "Desired outcome"], ["proposed-solution", "Proposed solution"], ["smallest-shippable-slice", "Smallest shippable slice"], ["user-stories", "User stories"], ["functional-requirements", "Functional requirements"], ["acceptance-criteria", "Acceptance criteria"], ["ux-and-interface-expectations", "UX and interface expectations"], ["business-rules", "Business rules"], ["edge-cases", "Edge cases"], ["non-functional-expectations", "Non-functional expectations"], ["existing-behavior-to-preserve", "Existing behavior to preserve"], ["non-goals", "Non-goals"], ["future-considerations", "Future considerations"], ["dependencies-and-constraints", "Dependencies and constraints"], ["risks-and-unresolved-decisions", "Risks and unresolved decisions"], ["definition-of-done", "Definition of done"], ["handoff-instructions", "Handoff instructions"],
] as const;
export const SECTION_IDS = SECTION_DEFINITIONS.map(x => x[0]); export const SECTION_TITLES = SECTION_DEFINITIONS.map(x => x[1]);
export const STATUSES = ["Draft", "Blocked by product decision", "Ready for design review", "Ready for technical planning", "Ready for implementation", "Returned for product revision"] as const;
export type SpecStatus = typeof STATUSES[number];
export type InterfaceImpact = "none" | "content_only" | "minor_interaction" | "substantial_ui" | "major_visual_direction" | "unknown";
export type Evidence = { statement: string; sources?: string[] };
export type EvidenceGroups = { facts: Evidence[]; inferences: Evidence[]; assumptions: Evidence[]; unresolved: Evidence[] };
export type FunctionalRequirement = { id: `FR-${string}`; text: string; repositoryClaim?: boolean; sources?: string[] };
export type AcceptanceCriterion = { id: `AC-${string}`; requirementIds: `FR-${string}`[]; behavior: string };
export type DefinitionOfDoneItem = { text: string; acceptanceCriteria: `AC-${string}`[] };
export type ProductState = "success" | "error" | "empty" | "loading" | "permission" | "interruption" | "recovery" | "duplicate" | "partial";
export type Failure = { code: string; path: string; message: string };

/** The sole caller-authored product contract. Status, failures and rendered sections are intentionally absent. */
export interface ProductSpecInput {
  schemaVersion: typeof SCHEMA_VERSION; pluginVersion: string; specId: string; slug: string; revision: number; generatedAt: string;
  title: string; hostIdentifier: string; requestedBy: string; pm?: { agent?: string; model?: string };
  executiveSummary: string; repositoryContext: string; targetUser: string; userProblem: string; desiredOutcome: string; proposedSolution: string; smallestShippableSlice: string;
  userStories: string[]; functionalRequirements: FunctionalRequirement[]; acceptanceCriteria: AcceptanceCriterion[];
  uxExpectations: string; businessRules: string[]; edgeCases: string[]; nonFunctionalExpectations: string[]; existingBehaviorToPreserve: string[];
  nonGoals: string[]; futureConsiderations: string[]; dependenciesAndConstraints: string[]; definitionOfDone: DefinitionOfDoneItem[]; handoffInstructions: string;
  evidence: EvidenceGroups; interfaceImpact: InterfaceImpact; contentChangesHierarchy?: boolean; contentChangesPublicBrand?: boolean; relevantStates?: ProductState[];
  highRiskBlockers?: string[]; technicalPlanningRequired?: boolean; additionalSections?: Array<{ id: string; title: string; body: string }>;
}
export interface EvaluatedSpec extends ProductSpecInput { status: SpecStatus; statusReason: string; validationFailures: Failure[]; designReviewRequired: boolean; designApproved: boolean; handoffEligible: boolean; productContentHash: string; evaluationPolicy: EvaluationPolicy; }
export type CanonicalSpec = EvaluatedSpec;
export interface DesignReviewApproval { schemaVersion: "1.0.0"; specId: string; revision: number; productContentHash: string; decision: "approved" | "changes_requested"; reviewer: { id: string; name: string; role?: string | undefined }; reviewedAt: string; evidence: string; }
export interface EvaluationPolicy { additionalNonGoals?: string[]; requiredAdditionalSections?: string[] }
