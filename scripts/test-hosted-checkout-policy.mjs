import assert from "node:assert/strict";
import {
  enforcesCommitEmailPolicy,
  isExpectedHostedCheckout,
  isHostedCheckoutShape,
  isSyntheticPullRequestMergeCheckout,
} from "./hosted-checkout-policy.mjs";

const commit = "a".repeat(40);
const tree = "b".repeat(40);
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

console.log("hosted checkout policy: PASS");
