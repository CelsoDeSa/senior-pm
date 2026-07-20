import assert from "node:assert/strict";
import {
  isExpectedHostedCheckout,
  isHostedCheckoutShape,
} from "./hosted-checkout-policy.mjs";

const commit = "a".repeat(40);
const tree = "b".repeat(40);
const expectedRemote = "https://github.com/CelsoDeSa/senior-pm";
const validPullRequest = {
  remotes: ["origin"],
  remoteUrl: expectedRemote,
  expectedRemote,
  repository: "CelsoDeSa/senior-pm",
  refs: ["refs/remotes/pull/1/merge"],
  eventName: "pull_request",
  githubRef: "refs/pull/1/merge",
};

assert.equal(isHostedCheckoutShape(validPullRequest), true, "accepts the exact GitHub PR merge checkout shape");
assert.equal(isHostedCheckoutShape({ ...validPullRequest, eventName: "push" }), false, "refuses a PR ref outside pull_request");
assert.equal(isHostedCheckoutShape({ ...validPullRequest, githubRef: "refs/pull/0/merge" }), false, "refuses a malformed PR ref");
assert.equal(isHostedCheckoutShape({ ...validPullRequest, refs: ["refs/remotes/pull/2/merge"] }), false, "refuses a mismatched PR number/local ref");
assert.equal(isHostedCheckoutShape({ ...validPullRequest, refs: ["refs/remotes/attacker/main"] }), false, "refuses arbitrary remote refs");
assert.equal(isHostedCheckoutShape({ ...validPullRequest, remoteUrl: "https://token@github.com/CelsoDeSa/senior-pm" }), false, "refuses an origin with embedded credentials");
assert.equal(isHostedCheckoutShape({ ...validPullRequest, refs: ["refs/remotes/origin/docs/readme-workflow-value"] }), true, "retains the push checkout ref policy");
assert.equal(isExpectedHostedCheckout({ githubActions: "true", expectedCommit: commit, expectedTree: tree, actualCommit: commit, actualTree: tree }), true, "accepts an exact expected commit and tree");
assert.equal(isExpectedHostedCheckout({ githubActions: "true", expectedCommit: commit, expectedTree: tree, actualCommit: "c".repeat(40), actualTree: tree }), false, "refuses an expected commit mismatch");
assert.equal(isExpectedHostedCheckout({ githubActions: "true", expectedCommit: commit, expectedTree: tree, actualCommit: commit, actualTree: "c".repeat(40) }), false, "refuses an expected tree mismatch");

console.log("hosted checkout policy: PASS");
