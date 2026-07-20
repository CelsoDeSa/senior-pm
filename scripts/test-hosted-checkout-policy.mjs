import assert from "node:assert/strict";
import {
  enforcesCommitEmailPolicy,
  isCanonicalGitHubPullRequestMerge,
  isGeneratedProtectedMainMergeCheckout,
  isExpectedHostedCheckout,
  isHostedCheckoutShape,
  isSyntheticPullRequestMergeCheckout,
  parseParentList,
} from "./hosted-checkout-policy.mjs";

const commit = "a".repeat(40);
const tree = "b".repeat(40);
const parentOne = "d".repeat(40);
const parentTwo = "e".repeat(40);
assert.deepEqual(parseParentList(`\n${parentOne}\n${parentTwo}\n`), [parentOne, parentTwo], "parses newline-delimited parent SHAs without whitespace");
assert.deepEqual(parseParentList(`${parentOne}\ninvalid`), [], "refuses a malformed parent SHA");
assert.deepEqual(parseParentList("\n\n"), [], "refuses an empty parent list");
const scheme = ["https:", ""].join("/");
const host = ["github", "com"].join(".");
const owner = ["Celso", "DeSa"].join("");
const packageName = ["senior", "pm"].join("-");
const expectedRemote = [scheme, host, owner, packageName].join("/");
const validPullRequest = {
  remotes: ["origin"],
  remoteUrl: expectedRemote,
  expectedRemote,
  repository: [owner, packageName].join("/"),
  refs: ["refs/remotes/pull/1/merge"],
  eventName: "pull_request",
  githubRef: "refs/pull/1/merge",
};

assert.equal(isHostedCheckoutShape(validPullRequest), true, "accepts the exact GitHub PR merge checkout shape");
assert.equal(isHostedCheckoutShape({ ...validPullRequest, eventName: "push" }), false, "refuses a PR ref outside pull_request");
assert.equal(isHostedCheckoutShape({ ...validPullRequest, githubRef: "refs/pull/0/merge" }), false, "refuses a malformed PR ref");
assert.equal(isHostedCheckoutShape({ ...validPullRequest, refs: ["refs/remotes/pull/2/merge"] }), false, "refuses a mismatched PR number/local ref");
assert.equal(isHostedCheckoutShape({ ...validPullRequest, refs: ["refs/remotes/attacker/main"] }), false, "refuses arbitrary remote refs");
assert.equal(isHostedCheckoutShape({ ...validPullRequest, remoteUrl: [scheme, ["token", host].join("@"), owner, packageName].join("/") }), false, "refuses an origin with embedded credentials");
assert.equal(isHostedCheckoutShape({ ...validPullRequest, refs: ["refs/remotes/origin/docs/readme-workflow-value"] }), true, "retains the push checkout ref policy");
assert.equal(isExpectedHostedCheckout({ githubActions: "true", expectedCommit: commit, expectedTree: tree, actualCommit: commit, actualTree: tree }), true, "accepts an exact expected commit and tree");
assert.equal(isExpectedHostedCheckout({ githubActions: "true", expectedCommit: commit, expectedTree: tree, actualCommit: "c".repeat(40), actualTree: tree }), false, "refuses an expected commit mismatch");
assert.equal(isExpectedHostedCheckout({ githubActions: "true", expectedCommit: commit, expectedTree: tree, actualCommit: commit, actualTree: "c".repeat(40) }), false, "refuses an expected tree mismatch");
const syntheticMerge = {
  eventName: "pull_request",
  githubRef: "refs/pull/1/merge",
  refs: ["refs/remotes/pull/1/merge"],
  expectedCommit: commit,
  actualCommit: commit,
  parents: ["d".repeat(40), "e".repeat(40)],
};
assert.equal(isSyntheticPullRequestMergeCheckout(syntheticMerge), true, "excludes only an exact synthetic PR merge checkout");
assert.equal(isSyntheticPullRequestMergeCheckout({ ...syntheticMerge, eventName: "push" }), false, "refuses synthetic exclusion outside pull_request");
assert.equal(isSyntheticPullRequestMergeCheckout({ ...syntheticMerge, githubRef: "refs/pull/0/merge" }), false, "refuses synthetic exclusion for an invalid PR ref");
assert.equal(isSyntheticPullRequestMergeCheckout({ ...syntheticMerge, actualCommit: "f".repeat(40) }), false, "refuses synthetic exclusion when the checkout SHA differs");
assert.equal(isSyntheticPullRequestMergeCheckout({ ...syntheticMerge, parents: ["d".repeat(40)] }), false, "refuses synthetic exclusion for a source commit");
const realCommit = "f".repeat(40);
assert.equal(enforcesCommitEmailPolicy({ commit: realCommit, syntheticMergeCommit: commit }), true, "enforces metadata policy for a violating reachable real commit");
assert.equal(enforcesCommitEmailPolicy({ commit, syntheticMergeCommit: commit }), false, "excludes only the proven synthetic merge commit");
const mainRef = ["refs", "heads", "main"].join("/");
const branch = ["docs", "workflow-value"].join("/");
const mergeMessage = [["Merge pull request #2 from", [owner, branch].join("/")].join(" "), "reviewed change"].join("\n\n");
const generatedMainMerge = {
  eventName: "push",
  githubRef: mainRef,
  repository: [owner, packageName].join("/"),
  canonicalRepository: [owner, packageName].join("/"),
  expectedCommit: commit,
  actualCommit: commit,
  parents: ["d".repeat(40), "e".repeat(40)],
  pushBefore: "d".repeat(40),
  pushAfter: commit,
  headCommitId: commit,
  mergeMessage,
  committerName: ["Git", "Hub"].join(""),
  committerEmail: ["noreply", host].join("@"),
  canonicalOwner: owner,
};
assert.equal(isGeneratedProtectedMainMergeCheckout(generatedMainMerge), true, "excludes only a proven generated protected-main merge checkout");
assert.equal(isCanonicalGitHubPullRequestMerge(generatedMainMerge), true, "accepts a strict historical generated merge");
assert.equal(isGeneratedProtectedMainMergeCheckout({ ...generatedMainMerge, githubRef: ["refs", "heads", "release"].join("/") }), false, "refuses a push outside protected main");
assert.equal(isGeneratedProtectedMainMergeCheckout({ ...generatedMainMerge, eventName: "pull_request" }), false, "refuses a non-push main merge exemption");
assert.equal(isGeneratedProtectedMainMergeCheckout({ ...generatedMainMerge, mergeMessage: "merge" }), false, "refuses a nonstandard merge message");
assert.equal(isGeneratedProtectedMainMergeCheckout({ ...generatedMainMerge, repository: ["other", packageName].join("/") }), false, "refuses the wrong repository");
assert.equal(isGeneratedProtectedMainMergeCheckout({ ...generatedMainMerge, canonicalOwner: "other" }), false, "refuses the wrong source owner");
assert.equal(isGeneratedProtectedMainMergeCheckout({ ...generatedMainMerge, parents: ["d".repeat(40)] }), false, "refuses a non-merge source commit");
assert.equal(isGeneratedProtectedMainMergeCheckout({ ...generatedMainMerge, committerName: "Maintainer" }), false, "refuses an ordinary two-parent source merge");
assert.equal(isGeneratedProtectedMainMergeCheckout({ ...generatedMainMerge, pushBefore: "f".repeat(40) }), false, "refuses a first-parent mismatch");
assert.equal(isGeneratedProtectedMainMergeCheckout({ ...generatedMainMerge, actualCommit: "f".repeat(40) }), false, "refuses a checkout SHA mismatch");
assert.equal(isCanonicalGitHubPullRequestMerge({ ...generatedMainMerge, committerEmail: ["maintainer", host].join("@") }), false, "refuses a historical merge with an unrecognized committer");
assert.equal(isCanonicalGitHubPullRequestMerge({ ...generatedMainMerge, mergeMessage: "merge" }), false, "refuses a malformed historical merge message");
assert.equal(isCanonicalGitHubPullRequestMerge({ ...generatedMainMerge, canonicalOwner: "other" }), false, "refuses a historical merge from another owner");
assert.equal(isCanonicalGitHubPullRequestMerge({ ...generatedMainMerge, repository: ["other", packageName].join("/") }), false, "refuses a historical merge in another repository");
assert.equal(isCanonicalGitHubPullRequestMerge({ ...generatedMainMerge, parents: ["d".repeat(40)] }), false, "refuses a historical non-merge commit");
assert.equal(isCanonicalGitHubPullRequestMerge({ ...generatedMainMerge, committerName: "Maintainer" }), false, "refuses an ordinary historical user merge");
assert.equal(enforcesCommitEmailPolicy({ commit: realCommit, generatedMainMergeCommit: commit }), true, "keeps a violating merge parent subject to metadata policy");
assert.equal(enforcesCommitEmailPolicy({ commit, generatedMainMergeCommit: commit }), false, "excludes only the proven generated main merge commit");
assert.equal(enforcesCommitEmailPolicy({ commit: realCommit, historicalGeneratedMerge: false }), true, "keeps a violating historical parent subject to metadata policy");

console.log("hosted checkout policy: PASS");
