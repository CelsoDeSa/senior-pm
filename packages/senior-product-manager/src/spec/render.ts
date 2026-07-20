import { SECTION_TITLES, type EvaluatedSpec } from "./contract.js";
import { deterministicJson, normalizeText, sha256 } from "./normalize.js";
export interface RenderedArtifacts { canonicalJson: string; markdown: string; handoffJson: string; canonicalContentHash: string }
const bullets = (xs: readonly string[]) => xs.length ? xs.map(x => `- ${x}`).join("\n") : "Not specified.";
const evidence = (s: EvaluatedSpec) => (["facts", "inferences", "assumptions", "unresolved"] as const).map(k => `**${k[0]!.toUpperCase()}${k.slice(1)}**\n${s.evidence[k].length ? s.evidence[k].map(x => `- ${x.statement}${x.sources?.length ? ` (${x.sources.join(", ")})` : ""}`).join("\n") : "- None."}`).join("\n\n");
const safe = (value: string) => normalizeText(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/^(\s*)#/gm, "$1\\#");
const safeTitle = (value: string) => safe(value).replace(/[\r\n]+/g, " ").trim();
function rawSectionBodies(s: EvaluatedSpec): string[] { return [
  `- Spec ID: ${s.specId}\n- Schema version: ${s.schemaVersion}\n- Plugin version: ${s.pluginVersion}\n- Revision: ${s.revision}\n- Generated at: ${s.generatedAt}\n- Host: ${s.hostIdentifier}\n- Requested by: ${s.requestedBy}${s.pm?.agent ? `\n- PM agent: ${s.pm.agent}` : ""}${s.pm?.model ? `\n- PM model: ${s.pm.model}` : ""}`,
  `${s.status}\n\nValidation failures: ${s.validationFailures.length}.`, s.executiveSummary, `${s.repositoryContext}\n\n${evidence(s)}`, s.targetUser, s.userProblem, s.desiredOutcome, s.proposedSolution, s.smallestShippableSlice,
  bullets(s.userStories), s.functionalRequirements.map(x => `- **${x.id}** ${x.text}`).join("\n"), s.acceptanceCriteria.map(x => `- **${x.id}** (${x.requirementIds.join(", ")}) ${x.behavior}`).join("\n"),
  `${s.uxExpectations}\n\nInterface impact: ${s.interfaceImpact}. Design review required: ${s.designReviewRequired ? "yes" : "no"}. Approved: ${s.designApproved ? "yes" : "no"}.`, bullets(s.businessRules), `${bullets(s.edgeCases)}\n\nRelevant states: ${(s.relevantStates ?? []).join(", ") || "none identified"}.`, bullets(s.nonFunctionalExpectations), bullets(s.existingBehaviorToPreserve), bullets(s.nonGoals), bullets(s.futureConsiderations), bullets(s.dependenciesAndConstraints), `${bullets(s.highRiskBlockers ?? [])}\n\n${bullets(s.evidence.unresolved.map(x => x.statement))}`, bullets(s.definitionOfDone.map(x=>`${x.text} (${x.acceptanceCriteria.join(", ")})`)), `${s.handoffInstructions}\n\nHandoff eligible: ${s.handoffEligible ? "yes" : "no"}.`,
]; }
export function sectionBodies(s: EvaluatedSpec): string[] { const bodies = rawSectionBodies(s); bodies[0] = `${bodies[0]}\n- Computed status: ${s.status}\n- Status reason: ${s.statusReason}`; bodies[1] = `${s.status}\n\n${s.statusReason}\n\nValidation failures: ${s.validationFailures.length}.`; return bodies; }
export function renderSpec(spec: EvaluatedSpec): RenderedArtifacts {
  const canonicalJson = deterministicJson(spec), canonicalContentHash = sha256(canonicalJson), bodies = sectionBodies(spec);
  const sections = SECTION_TITLES.map((title, i) => `## ${i + 1}. ${title}\n\n${safe(bodies[i]!).trim()}\n`);
  const extras = (spec.additionalSections ?? []).map((x, i) => `## ${24 + i}. ${safeTitle(x.title)}\n\n${safe(x.body).trim()}\n`);
  const markdown = normalizeText(`# ${safeTitle(spec.title)}\n\nCanonical SHA-256: \`${canonicalContentHash}\`\nProduct-content SHA-256: \`${spec.productContentHash}\`\n\n${[...sections, ...extras].join("\n").trimEnd()}\n`);
  const headings = markdown.match(/^#{1,2} .+$/gm) ?? [], expected = [`# ${safeTitle(spec.title)}`, ...SECTION_TITLES.map((title,i)=>`## ${i+1}. ${title}`), ...(spec.additionalSections??[]).map((x,i)=>`## ${24+i}. ${safeTitle(x.title)}`)];
  if (headings.length !== expected.length || headings.some((heading,i)=>heading!==expected[i])) throw new Error("Rendered Markdown heading integrity failure");
  const handoffJson = deterministicJson({ schemaVersion: spec.schemaVersion, specId: spec.specId, revision: spec.revision, status: spec.status, canonicalContentHash, productContentHash: spec.productContentHash, generatedAt: spec.generatedAt, hostIdentifier: spec.hostIdentifier, requestedBy: spec.requestedBy, instructions: spec.handoffInstructions, validationFailures: spec.validationFailures, handoffEligible: spec.handoffEligible });
  return { canonicalJson, markdown, handoffJson, canonicalContentHash };
}
export type PersistedArtifactMetadata = { file: string; sha256: string };
export function artifactManifest(spec: EvaluatedSpec, r: RenderedArtifacts, persisted: { designReview?: PersistedArtifactMetadata; priorArtifact?: PersistedArtifactMetadata } = {}) { return deterministicJson({ schemaVersion: "1.0.0", specId: spec.specId, revision: spec.revision, status: spec.status, canonicalContentHash: r.canonicalContentHash, committed: true, files: { canonicalJson: sha256(r.canonicalJson), markdown: sha256(r.markdown), handoffJson: sha256(r.handoffJson), ...persisted } }); }
