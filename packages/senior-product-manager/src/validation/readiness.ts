import type { InterfaceImpact, ProductSpecInput, SpecStatus } from "../spec/contract.js";
export type GateInput = { failures: readonly unknown[]; highRiskBlocked: boolean; designReviewRequired: boolean; designApproved: boolean; technicalPlanningRequired: boolean; priorStatus?: SpecStatus | undefined };
export const HANDOFF_ELIGIBLE: Readonly<Record<SpecStatus, boolean>> = Object.freeze({ Draft: false, "Blocked by product decision": false, "Ready for design review": false, "Ready for technical planning": true, "Ready for implementation": true, "Returned for product revision": false });
export const READINESS_DECISION_TABLE = [
  { id: "prior-ready-invalid", when: (x: GateInput) => !!x.failures.length && ["Ready for technical planning", "Ready for implementation"].includes(x.priorStatus ?? "Draft"), status: "Returned for product revision" },
  { id: "high-risk", when: (x: GateInput) => x.highRiskBlocked, status: "Blocked by product decision" },
  { id: "invalid", when: (x: GateInput) => !!x.failures.length, status: "Draft" },
  { id: "design", when: (x: GateInput) => x.designReviewRequired && !x.designApproved, status: "Ready for design review" },
  { id: "planning", when: (x: GateInput) => x.technicalPlanningRequired, status: "Ready for technical planning" },
  { id: "direct", when: () => true, status: "Ready for implementation" },
] as const;
export function decideReadiness(input: GateInput): SpecStatus { return READINESS_DECISION_TABLE.find(x => x.when(input))!.status; }
export function requiresDesignReview(spec: Pick<ProductSpecInput, "interfaceImpact" | "contentChangesHierarchy" | "contentChangesPublicBrand">): boolean { const impact: InterfaceImpact = spec.interfaceImpact; return impact === "unknown" || ["minor_interaction", "substantial_ui", "major_visual_direction"].includes(impact) || (impact === "content_only" && !!(spec.contentChangesHierarchy || spec.contentChangesPublicBrand)); }
