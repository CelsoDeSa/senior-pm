import { constants } from "node:fs";
import { type FileHandle } from "node:fs/promises";
import path from "node:path";
import { fdChild, openPinnedDirectory, openPinnedRegular, PinnedRepositoryRoot, repositoryCanonicalPath, type DescriptorResolver, type RepositoryRoot } from "../shared/secure-fs.js";
import type { EvaluatedSpec, EvaluationPolicy, ProductSpecInput, SpecStatus } from "../spec/contract.js";
import { deterministicJson, sha256 } from "../spec/normalize.js";
import { artifactManifest, renderSpec } from "../spec/render.js";
import { evaluateSpecInternal } from "./validate.js";
import { designApprovalSchema, evaluatedSpecSchema, handoffSchema, manifestSchema, priorArtifactMetadataSchema, productSpecInputSchema } from "./schemas.js";
import { validateOutputRoot } from "../spec/output-root.js";
import { ACCEPTED_OWNERSHIP_MARKERS } from "../shared/constants.js";

const DERIVED = new Set(["status", "statusReason", "validationFailures", "designReviewRequired", "designApproved", "handoffEligible", "productContentHash", "evaluationPolicy"]);
function inputOf(value: EvaluatedSpec): ProductSpecInput { return productSpecInputSchema.parse(Object.fromEntries(Object.entries(value).filter(([key]) => !DERIVED.has(key)))) as unknown as ProductSpecInput; }
async function readChild(dir: FileHandle, name: string, root: string, repo: string, resolver?: DescriptorResolver) {
  const handle = await openPinnedRegular(dir, name, path.join(root, name), repo, constants.O_RDONLY, resolver);
  try { if((await handle.stat()).size>2_000_000)throw new Error("Artifact exceeds 2000000 bytes");return await handle.readFile("utf8"); } finally { await handle.close(); }
}
export interface PriorArtifactReference { repositoryRoot: RepositoryRoot; outputRoot: string; base: string }
export interface ArtifactValidationOptions { descriptorTarget?: DescriptorResolver | undefined; maxPriorDepth?: number; _depth?: number; currentPolicy?: EvaluationPolicy }
export async function validateArtifactSet(repositoryRootInput: RepositoryRoot, outputRootInput: string, base: string, options: ArtifactValidationOptions = {}) {
  const failures: string[] = [];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.r\d+$/.test(base)) return { valid: false, failures: ["Invalid artifact base"] };
  if (process.platform !== "linux") return { valid: false, failures: ["Secure artifact validation requires Linux descriptor-target verification"] };
  const opts = options;
  let repoFd:FileHandle|undefined,rootFd: FileHandle | undefined;
  try {
    const repo = await repositoryCanonicalPath(repositoryRootInput), outputRelative = validateOutputRoot(outputRootInput);repoFd=repositoryRootInput instanceof PinnedRepositoryRoot?await repositoryRootInput.duplicate():await openPinnedDirectory(repo,repo,opts.descriptorTarget);let current=repoFd,root=repo;for(const part of outputRelative.split(path.sep)){root=path.join(root,part);const next=await openPinnedDirectory(fdChild(current,part),repo,opts.descriptorTarget,root);if(current!==repoFd)await current.close();current=next;}rootFd=current;
    if (!ACCEPTED_OWNERSHIP_MARKERS.has(await readChild(rootFd, ".senior-pm-owned.json", root, repo, opts.descriptorTarget))) throw new Error("Invalid ownership marker");
    const [canonicalText, markdown, handoffText, manifestText] = await Promise.all([readChild(rootFd, `${base}.json`, root, repo, opts.descriptorTarget), readChild(rootFd, `${base}.md`, root, repo, opts.descriptorTarget), readChild(rootFd, `${base}.handoff.json`, root, repo, opts.descriptorTarget), readChild(rootFd, `${base}.manifest.json`, root, repo, opts.descriptorTarget)]);
    let rawCanonical: unknown, rawHandoff: unknown, rawManifest: unknown;
    try { rawCanonical = JSON.parse(canonicalText); rawHandoff = JSON.parse(handoffText); rawManifest = JSON.parse(manifestText); }
    catch { return { valid: false, failures: ["Artifact JSON is malformed"] }; }
    const canonicalParsed = evaluatedSpecSchema.safeParse(rawCanonical), handoffParsed = handoffSchema.safeParse(rawHandoff), manifestParsed = manifestSchema.safeParse(rawManifest);
    if (!canonicalParsed.success) failures.push(`Canonical schema invalid: ${canonicalParsed.error.issues.map(x => x.path.join(".")).join(",")}`);
    if (!handoffParsed.success) failures.push("Handoff schema invalid"); if (!manifestParsed.success) failures.push("Manifest schema invalid");
    if (!canonicalParsed.success || !handoffParsed.success || !manifestParsed.success) return { valid: false, failures };
    const canonical = canonicalParsed.data as unknown as EvaluatedSpec;
    let approval:unknown,validatedPriorStatus: SpecStatus | undefined; const persisted:Record<string,{file:string;sha256:string}>={};
    if(manifestParsed.data.files.designReview){const meta=manifestParsed.data.files.designReview,bytes=await readChild(rootFd,meta.file,root,repo,opts.descriptorTarget);if(sha256(bytes)!==meta.sha256)failures.push("Persisted design review hash mismatch");else{try{const parsed=designApprovalSchema.safeParse(JSON.parse(bytes));if(!parsed.success)failures.push("Persisted design review schema invalid");else approval=parsed.data;}catch{failures.push("Persisted design review JSON malformed");}}persisted.designReview=meta;}
    if(manifestParsed.data.files.priorArtifact){const depth=opts._depth??0,max=opts.maxPriorDepth??20;if(depth>=max)failures.push("Prior artifact recursion limit exceeded");else{const meta=manifestParsed.data.files.priorArtifact,bytes=await readChild(rootFd,meta.file,root,repo,opts.descriptorTarget);if(sha256(bytes)!==meta.sha256)failures.push("Persisted prior metadata hash mismatch");else{try{const parsed=priorArtifactMetadataSchema.safeParse(JSON.parse(bytes));if(!parsed.success)failures.push("Persisted prior metadata schema invalid");else{const p=parsed.data,prior=await validateArtifactSet(repositoryRootInput,outputRelative,p.base,{descriptorTarget:opts.descriptorTarget,maxPriorDepth:max,_depth:depth+1});if(!prior.valid||!prior.spec||p.specId!==canonical.specId||p.slug!==canonical.slug||p.hostIdentifier!==canonical.hostIdentifier||p.revision>=canonical.revision||prior.spec.revision!==p.revision)failures.push("Persisted prior artifact lineage invalid");else validatedPriorStatus=prior.spec.status;}}catch{failures.push("Persisted prior metadata JSON malformed");}}persisted.priorArtifact=meta;}}
    const goals=[...new Set([...(canonical.evaluationPolicy.additionalNonGoals??[]),...(opts.currentPolicy?.additionalNonGoals??[])])],sections=[...new Set([...(canonical.evaluationPolicy.requiredAdditionalSections??[]),...(opts.currentPolicy?.requiredAdditionalSections??[])])],mergedPolicy={...(goals.length?{additionalNonGoals:goals}:{}),...(sections.length?{requiredAdditionalSections:sections}:{})};const reevaluated = evaluateSpecInternal(inputOf(canonical), approval, { validatedPriorStatus },mergedPolicy);
    if(opts.currentPolicy&&reevaluated.validationFailures.some(f=>f.code.startsWith("policy.")))return{valid:false,handoffEligible:false,revisionRequired:true,failures:["policy_outdated: immutable artifact does not satisfy current effective policy"]};
    if (deterministicJson(reevaluated) !== canonicalText) failures.push("Canonical evaluation/status/failures are stale or forged");
    const rendered = renderSpec(reevaluated);
    if (rendered.markdown !== markdown || rendered.handoffJson !== handoffText) failures.push("Rendered artifact differs from canonical input");
    if (artifactManifest(reevaluated, rendered,persisted) !== manifestText) failures.push("Manifest differs from regenerated byte hashes");
    for (const identity of [handoffParsed.data, manifestParsed.data]) if (identity.specId !== canonical.specId || identity.revision !== canonical.revision || identity.status !== canonical.status || identity.schemaVersion !== canonical.schemaVersion || identity.canonicalContentHash !== sha256(canonicalText)) failures.push("Artifact identity/status/hash mismatch");
    return { valid: failures.length === 0, failures, spec: failures.length ? undefined : canonical };
  } catch (error) { return { valid: false, failures: [`Committed artifact set is missing, malformed, or insecure: ${(error as Error).message}`] }; }
  finally { await rootFd?.close().catch(() => undefined);if(repoFd&&repoFd!==rootFd)await repoFd.close().catch(()=>undefined); }
}
