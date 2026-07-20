import { z } from "zod";
import { SECTION_IDS } from "../spec/contract.js";
import { validateOutputRoot } from "../spec/output-root.js";

const inheritable = z.union([z.literal("inherit"), z.string().min(1)]);
const relativeDedicatedPath = z.string().max(240).refine(value => { if (value === "auto") return true; try { validateOutputRoot(value); return true; } catch { return false; } }, "must be a safe dedicated relative directory ending in senior-pm");
const short = z.string().min(1).max(240), list = z.array(short).max(100);
export const limitsSchema = z.object({ max_depth: z.number().int().min(0).max(20), max_files: z.number().int().positive().max(10_000), max_file_bytes: z.number().int().positive().max(1_000_000), max_total_bytes: z.number().int().positive().max(10_000_000), timeout_ms: z.number().int().positive().max(60_000) }).partial().strict();
export const seniorPmSettingsSchema = z.object({
  enabled: z.boolean().optional(), mode: z.enum(["interactive", "autonomous"]).optional(), model: inheritable.optional(), fallback_model: inheritable.optional(), reasoning: z.string().min(1).optional(), effort: z.string().min(1).optional(),
  context_limits: limitsSchema.optional(), tool_restrictions: list.optional(), denied_permissions: z.record(z.literal("deny")).optional(), specification_directory: relativeDedicatedPath.optional(), handoff_candidates: list.optional(), invocation_target: short.optional(),
  require_design_review_for_ui: z.boolean().optional(), allow_repository_history: z.boolean().optional(), allow_external_research: z.boolean().optional(), allow_programmatic_invocation: z.boolean().optional(),
  product_context_files: list.optional(), design_context_files: list.optional(), additional_non_goals: list.optional(), required_specification_sections: list.optional(),
  permission_profile: z.enum(["strict", "restricted"]).optional(), product_principles: list.optional(), role_mappings: z.record(short).optional(), adapter_metadata: z.record(z.union([short,z.number().finite(),z.boolean(),list])).optional()
}).strict();
export const configDocumentSchema = z.object({ senior_pm: seniorPmSettingsSchema }).strict();
export type SeniorPmSettings = z.infer<typeof seniorPmSettingsSchema>;
export type ConfigDocument = z.infer<typeof configDocumentSchema>;
export const DEFAULT_SETTINGS: SeniorPmSettings = {
  enabled: true, mode: "interactive", model: "inherit", fallback_model: "inherit", reasoning: "inherit", effort: "inherit",
  context_limits: { max_depth: 6, max_files: 200, max_file_bytes: 64_000, max_total_bytes: 1_000_000, timeout_ms: 3_000 }, tool_restrictions: ["edit", "bash", "task"], denied_permissions: { edit: "deny", bash: "deny", task: "deny" }, specification_directory: "auto", handoff_candidates: [],
  require_design_review_for_ui: true, allow_repository_history: false, allow_external_research: false, allow_programmatic_invocation: false,
  product_context_files: [], design_context_files: [], additional_non_goals: [], required_specification_sections: SECTION_IDS, permission_profile: "strict", product_principles: [], role_mappings: {}, adapter_metadata: {}
};
export function evaluationPolicyFromConfig(settings: SeniorPmSettings) { return { additionalNonGoals: settings.additional_non_goals ?? [], requiredAdditionalSections: (settings.required_specification_sections ?? []).filter(id => !SECTION_IDS.includes(id as typeof SECTION_IDS[number])) }; }
