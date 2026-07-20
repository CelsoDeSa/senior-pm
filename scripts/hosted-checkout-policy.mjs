const hash = /^[a-f0-9]{40}$/;

export const isExpectedHostedCheckout = ({
  githubActions,
  expectedCommit,
  expectedTree,
  actualCommit,
  actualTree,
}) =>
  githubActions === "true" &&
  hash.test(expectedCommit ?? "") &&
  hash.test(expectedTree ?? "") &&
  actualCommit === expectedCommit &&
  actualTree === expectedTree;

const expectedPullRequestMergeRef = ({ eventName, githubRef }) => {
  if (eventName !== "pull_request") return undefined;
  const match = /^refs\/pull\/([1-9][0-9]*)\/merge$/.exec(githubRef ?? "");
  return match ? `refs/remotes/pull/${match[1]}/merge` : undefined;
};

export const isHostedCheckoutShape = ({
  remotes,
  remoteUrl,
  expectedRemote,
  repository,
  refs,
  eventName,
  githubRef,
}) => {
  const pullRequestMergeRef = expectedPullRequestMergeRef({ eventName, githubRef });
  return (
    remotes.length === 1 &&
    remotes[0] === "origin" &&
    !!repository &&
    (remoteUrl === expectedRemote || remoteUrl === `${expectedRemote}.git`) &&
    !/[A-Za-z0-9._-]+:[^/@]+@/.test(remoteUrl) &&
    refs.every(
      (ref) =>
        ref.startsWith("refs/heads/") ||
        ref.startsWith("refs/remotes/origin/") ||
        (pullRequestMergeRef !== undefined && ref === pullRequestMergeRef),
    )
  );
};

export const isSyntheticPullRequestMergeCheckout = ({
  eventName,
  githubRef,
  refs,
  expectedCommit,
  actualCommit,
  parents,
}) => {
  const pullRequestMergeRef = expectedPullRequestMergeRef({ eventName, githubRef });
  return (
    pullRequestMergeRef !== undefined &&
    refs.includes(pullRequestMergeRef) &&
    hash.test(expectedCommit ?? "") &&
    actualCommit === expectedCommit &&
    parents.length === 2 &&
    parents.every((parent) => hash.test(parent))
  );
};

export const isGeneratedProtectedMainMergeCheckout = ({
  eventName,
  githubRef,
  repository,
  canonicalRepository,
  expectedCommit,
  actualCommit,
  parents,
  pushBefore,
  pushAfter,
  headCommitId,
  mergeMessage,
  committerName,
  committerEmail,
  canonicalOwner,
}) => {
  const message = /^Merge pull request #([1-9][0-9]*) from ([A-Za-z0-9-]+)\/([A-Za-z0-9][A-Za-z0-9._/-]*)\n\n[^\0]+$/.exec(mergeMessage ?? "");
  return (
    eventName === "push" &&
    githubRef === "refs/heads/main" &&
    repository === canonicalRepository &&
    hash.test(expectedCommit ?? "") &&
    actualCommit === expectedCommit &&
    parents.length === 2 &&
    parents[0] !== parents[1] &&
    parents.every((parent) => hash.test(parent)) &&
    pushBefore === parents[0] &&
    pushAfter === actualCommit &&
    headCommitId === actualCommit &&
    message !== null &&
    message[2] === canonicalOwner &&
    committerName === "GitHub" &&
    committerEmail === ["noreply", ["github", "com"].join(".")].join("@")
  );
};

export const enforcesCommitEmailPolicy = ({ commit, syntheticMergeCommit, generatedMainMergeCommit }) =>
  commit !== syntheticMergeCommit && commit !== generatedMainMergeCommit;
