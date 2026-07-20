export const SPEC_LIMITS = Object.freeze({
  string: 20_000, slug: 120, identifier: 200, path: 240,
  strings: 200, sources: 50, requirements: 500, criteria: 1_000,
  criterionReferences: 100, evidencePerGroup: 500, definitionOfDone: 500,
  additionalSections: 50, relevantStates: 9, failures: 1_000,
  policyNonGoals: 100, policySections: 50, artifactBytes: 2_000_000,
  approvalBytes: 64_000, configBytes: 1_000_000, priorDepth: 20,
} as const);
export const SPEC_FORMATS = Object.freeze({
  slug: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  functionalRequirementId: /^FR-\d{3}$/,
  acceptanceCriterionId: /^AC-\d{3}$/,
  sectionId: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  safeReference: /^(?![A-Za-z]:)(?![/\\])(?!.*\.\.)[\p{L}\p{N}._/@:# +\\-]+$/u,
  provenanceId: /^[\p{L}\p{N}._:@+ -]+$/u,
  sha256: /^[a-f0-9]{64}$/,
  artifactBase: /^[a-z0-9]+(?:-[a-z0-9]+)*\.r\d+$/,
  persistedFile: /^[a-z0-9]+(?:-[a-z0-9]+)*\.r\d+\.(?:design-review|prior-artifact)\.json$/,
} as const);
export const PLACEHOLDER_PATTERN = /\b(tbd|todo|placeholder|lorem(?: ipsum)?|unknown|later|to be determined|fill this|coming soon|fixme|xxx)\b/i;
export function isMeaningfulContent(value: string): boolean { return !!value?.trim() && !PLACEHOLDER_PATTERN.test(value) && !/^(n\/?a|none|not applicable\s*[—-]?)$/i.test(value.trim()); }
