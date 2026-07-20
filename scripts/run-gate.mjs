import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { lstat, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  enforcesCommitEmailPolicy,
  isExpectedHostedCheckout,
  isHostedCheckoutShape,
  isSyntheticPullRequestMergeCheckout,
} from "./hosted-checkout-policy.mjs";

const gate = process.argv[2];
if (!new Set(["A", "B", "C", "D"]).has(gate))
  throw new Error("Gate must be A, B, C, or D");
const root = process.cwd();
const option = (name) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
};
const gateMode = gate === "A" ? option("mode") ?? "local" : "local";
if (gate === "A" && !new Set(["local", "hosted"]).has(gateMode))
  throw new Error("Gate A mode must be local or hosted");
const evidence = path.join(root, ".candidate-evidence");
await mkdir(evidence, { recursive: true });
const checks = [];
const record = (name, ok, output, exceptions = []) => {
  checks.push({ name, ok, output, exceptions });
  if (!ok) throw new Error(`${name}: ${output}`);
};
const run = (command, args, options = {}) =>
  spawnSync(command, args, { cwd: root, encoding: "utf8", ...options });
const exact = (command, args) =>
  execFileSync(command, args, { cwd: root, encoding: "utf8" }).trim();
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const canonicalSourceUrl =
  "https://github.com/" + ["Celso", "DeSa"].join("") + "/senior-pm";
const canonicalSourceUrlPattern = new RegExp(
  canonicalSourceUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[^\\s<>\"'`)]*",
  "g",
);
const disallowedCanonicalSourceUrls = (text, allowedLocation) =>
  [...text.matchAll(canonicalSourceUrlPattern)]
    .map((match) => match[0])
    .filter((url) => !allowedLocation || url !== canonicalSourceUrl);
const tracked = () =>
  exact("git", ["ls-files", "-z"]).split("\0").filter(Boolean).sort();
const report = async (verdict) => {
  const payload = {
    gate,
    mode: gateMode,
    date: "2026-07-19",
    verdict,
    tools: {
      node: process.version,
      npm: exact("npm", ["--version"]),
      git: exact("git", ["--version"]),
    },
    checks,
  };
  await writeFile(
    path.join(evidence, `gate-${gate}.json`),
    JSON.stringify(payload, null, 2) + "\n",
  );
};
let syntheticMergeCommit;

try {
  if (gate === "A") {
    const files = tracked();
    const roots = exact("git", ["rev-list", "--max-parents=0", "--all"])
      .split("\n")
      .filter(Boolean);
    record(
      "fresh-root-single-ancestry-root",
      roots.length === 1,
      `roots=${roots.length}`,
    );
    if (gateMode === "local") {
      const remotes = exact("git", ["remote"]);
      record("fresh-root-no-remotes", remotes === "", remotes || "no remotes");
      const refs = exact("git", ["for-each-ref", "--format=%(refname)"])
        .split("\n")
        .filter(Boolean);
      record(
        "fresh-root-local-refs-only",
        refs.length === 1 && refs[0] === "refs/heads/main",
        refs.join(",") || "none",
      );
    } else {
      const expectedCommit = option("expected-commit");
      const expectedTree = option("expected-tree");
      const actualCommit = exact("git", ["rev-parse", "HEAD"]);
      const actualTree = exact("git", ["rev-parse", "HEAD^{tree}"]);
      record(
        "hosted-expected-checkout",
        isExpectedHostedCheckout({
          githubActions: process.env.GITHUB_ACTIONS,
          expectedCommit,
          expectedTree,
          actualCommit,
          actualTree,
        }),
        `actions=${process.env.GITHUB_ACTIONS ?? "unset"} commit=${actualCommit} tree=${actualTree}`,
      );
      const remotes = exact("git", ["remote"])
        .split("\n")
        .filter(Boolean);
      const remoteUrl = remotes.length === 1 ? exact("git", ["remote", "get-url", "origin"]) : "";
      const expectedRemote = `${process.env.GITHUB_SERVER_URL ?? ""}/${process.env.GITHUB_REPOSITORY ?? ""}`;
      const refs = exact("git", ["for-each-ref", "--format=%(refname)"])
        .split("\n")
        .filter(Boolean);
      record(
        "hosted-actions-checkout-shape",
        isHostedCheckoutShape({
          remotes,
          remoteUrl,
          expectedRemote,
          repository: process.env.GITHUB_REPOSITORY,
          refs,
          eventName: process.env.GITHUB_EVENT_NAME,
          githubRef: process.env.GITHUB_REF,
        }),
        `remotes=${remotes.join(",") || "none"} refs=${refs.join(",") || "detached"}`,
      );
      const checkoutParents = exact("git", ["show", "-s", "--format=%P", actualCommit])
        .split(" ")
        .filter(Boolean);
      const syntheticMergeCheckout = isSyntheticPullRequestMergeCheckout({
        eventName: process.env.GITHUB_EVENT_NAME,
        githubRef: process.env.GITHUB_REF,
        refs,
        expectedCommit,
        actualCommit,
        parents: checkoutParents,
      });
      record(
        "hosted-pr-merge-metadata-exemption-shape",
        process.env.GITHUB_EVENT_NAME !== "pull_request" || syntheticMergeCheckout,
        `event=${process.env.GITHUB_EVENT_NAME ?? "unset"} commit=${actualCommit} parents=${checkoutParents.length}`,
      );
      if (syntheticMergeCheckout) syntheticMergeCommit = actualCommit;
    }
    const inventory = JSON.parse(
      await readFile(path.join(root, "docs/export-inventory.json"), "utf8"),
    );
    const mapped = inventory.entries.map((entry) => entry.path).sort();
    record(
      "complete-export-inventory",
      JSON.stringify(files) === JSON.stringify(mapped),
      `tracked=${files.length} mapped=${mapped.length}`,
    );
    const personalNameAllowed = new Set([
      "LICENSE",
      "packages/senior-product-manager/LICENSE",
      "packages/senior-product-manager/src/spec/contract.ts",
      "packages/senior-product-manager/schemas/legacy/senior-pm-spec.legacy.schema.json",
      "packages/senior-product-manager/schemas/legacy/senior-pm-design-review.legacy.schema.json",
      "packages/senior-product-manager/test/fixtures/compatibility/legacy-byte/fixture.json",
      "packages/senior-product-manager/test/unit/installer/installer.test.ts",
    ]);
    const canonicalSourceAllowed = new Set([
      "README.md",
      "docs/distribution.md",
      "docs/installation.md",
      "packages/senior-product-manager/README.md",
    ]);
    const formerOwnerAllowed = new Set([
      "packages/senior-product-manager/src/shared/constants.ts",
      "packages/senior-product-manager/src/installer/legacy-migration.ts",
      "packages/senior-product-manager/assets/compatibility/known-legacy-0.1.0-fingerprint.json",
      "packages/senior-product-manager/test/fixtures/compatibility/legacy-byte/fixture.json",
      "packages/senior-product-manager/test/unit/installer/installer.test.ts",
      "packages/senior-product-manager/test/unit/spec/render.test.ts",
      "docs/compatibility.md",
    ]);
    const formerSchemaAllowed = new Set([
      "packages/senior-product-manager/src/spec/contract.ts",
      "packages/senior-product-manager/schemas/legacy/senior-pm-spec.legacy.schema.json",
      "packages/senior-product-manager/schemas/legacy/senior-pm-design-review.legacy.schema.json",
      "packages/senior-product-manager/test/fixtures/compatibility/legacy-byte/fixture.json",
      "packages/senior-product-manager/test/unit/installer/installer.test.ts",
    ]);
    const formerNamespace = ["elon", "musk", "agents"].join("-");
    const formerOwner = `${formerNamespace}.senior-product-manager`;
    const formerPackage = `@${formerNamespace}/senior-product-manager`;
    const formerSchemaPrefix = `https://github.com/${["Celso", "DeSa"].join("")}/${formerNamespace}/schemas/`;
    const formerArchivePrefix = `${formerNamespace}-senior-product-manager-`;
    const fakeFixture =
      "packages/senior-product-manager/test/fixtures/security/invalid-credentials.txt";
    const fakeDiscoveryTest =
      "packages/senior-product-manager/test/unit/repository/discover.test.ts";
    const reservedFakeValues = new Set([
      "AKIA" + "0".repeat(16),
      "ghp_" + "0".repeat(36),
    ]);
    const scanPolicy = (file, text, output) => {
      const privateSamplePattern = new RegExp(
        ["resume", "committed", "pm", "workflow"].join("-"),
        "g",
      );
      const privateReportPattern = new RegExp(
        ["rebrand", "migration"].join("-") + "\\.md",
        "g",
      );
      for (const pattern of [
        /\/home\/[A-Za-z0-9._-]+\//g,
        /actions\/runs\//g,
        privateSamplePattern,
        privateReportPattern,
        /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
      ])
        if (pattern.test(text)) output.push(`${file}:${pattern.source}`);
      for (const url of disallowedCanonicalSourceUrls(
        text,
        canonicalSourceAllowed.has(file),
      ))
        output.push(`${file}:canonical-source-url:${url}`);
      const ownerName = ["Celso", "DeSa"].join("");
      if (
        text.includes(ownerName) &&
        !personalNameAllowed.has(file) &&
        !canonicalSourceAllowed.has(file)
      )
        output.push(`${file}:owner-name`);
      if (text.includes(formerOwner) && !formerOwnerAllowed.has(file))
        output.push(`${file}:former-owner-outside-compatibility`);
      if (text.includes(formerSchemaPrefix) && !formerSchemaAllowed.has(file))
        output.push(`${file}:former-schema-prefix-outside-compatibility`);
      if (text.includes(formerPackage)) output.push(`${file}:former-package-active`);
      if (text.includes(formerArchivePrefix)) output.push(`${file}:former-archive-active`);
      if (
        file.endsWith(".md") &&
        (text.includes(formerOwner) || text.includes(formerSchemaPrefix)) &&
        !(file === "docs/compatibility.md" && /no affiliation/i.test(text))
      )
        output.push(`${file}:legacy-documentation-context`);
      const fakeMatches = [
        ...text.matchAll(/(?:AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{36})/g),
      ].map((match) => match[0]);
      if (
        fakeMatches.length &&
        !(
          [fakeFixture, fakeDiscoveryTest].includes(file) &&
          fakeMatches.every((value) => reservedFakeValues.has(value))
        )
      )
        output.push(`${file}:credential-pattern`);
    };
    const forbidden = [];
    const canonicalPolicyCases = [
      [canonicalSourceUrl, true],
      [canonicalSourceUrl + "-source-preview", false],
      [canonicalSourceUrl + "-evidence-vault", false],
      [canonicalSourceUrl + "/tree/main", false],
      [canonicalSourceUrl + "?ref=main", false],
      [canonicalSourceUrl + "#readme", false],
    ];
    record(
      "canonical-source-url-policy-variants",
      canonicalPolicyCases.every(
        ([url, allowed]) =>
          disallowedCanonicalSourceUrls(url, true).length === (allowed ? 0 : 1),
      ) && disallowedCanonicalSourceUrls(canonicalSourceUrl, false).length === 1,
      "canonical=allowed; source-preview/evidence-vault/path/query/fragment=refused",
    );
    for (const file of files) {
      const bytes = await readFile(path.join(root, file));
      if (bytes.includes(0)) continue;
      scanPolicy(file, bytes.toString("utf8"), forbidden);
    }
    record(
      "secret-private-metadata-scan",
      forbidden.length === 0,
      forbidden.join(";") || "clean",
      [
        {
          paths: [fakeFixture, fakeDiscoveryTest],
          values: "reserved all-zero invalid fixtures only",
        },
        {
          paths: [...new Set([...formerOwnerAllowed, ...formerSchemaAllowed])],
          values: "exact former owner/schema literals in explicit compatibility locations only; former package/archive prefixes prohibited",
        },
        {
          paths: [...canonicalSourceAllowed],
          values: "exact canonical source URL in public documentation only",
        },
      ],
    );
    const historyForbidden = [];
    const commits = exact("git", ["rev-list", "--all"])
      .split("\n")
      .filter(Boolean);
    const scannedHistoryBlobs = new Set();
    for (const commit of commits) {
      const tree = execFileSync("git", ["ls-tree", "-r", "-z", commit], { cwd: root });
      for (const row of tree.toString("utf8").split("\0").filter(Boolean)) {
        const tab = row.indexOf("\t");
        const metadata = row.slice(0, tab).split(" ");
        const file = row.slice(tab + 1);
        const object = metadata[2];
        const key = `${object}:${file}`;
        if (scannedHistoryBlobs.has(key)) continue;
        scannedHistoryBlobs.add(key);
        const bytes = execFileSync("git", ["cat-file", "blob", object], {
          cwd: root,
          maxBuffer: 50 * 1024 * 1024,
        });
        if (bytes.includes(0)) continue;
        const findings = [];
        scanPolicy(file, bytes.toString("utf8"), findings);
        historyForbidden.push(...findings.map((finding) => `${commit.slice(0, 12)}:${finding}`));
      }
    }
    const metadata = execFileSync(
      "git",
      ["log", "--format=%H%x00%ae%x00%ce%x00%B%x00", "--all"],
      { cwd: root, encoding: "utf8" },
    ).split("\0");
    const noreply = /^\d+\+[A-Za-z0-9-]+@users\.noreply\.github\.com$/;
    for (let index = 0; index + 3 < metadata.length; index += 4) {
      const [commit, authorEmail, committerEmail, message] = metadata.slice(index, index + 4);
      if (!commit) continue;
      if (
        enforcesCommitEmailPolicy({ commit, syntheticMergeCommit }) &&
        (!noreply.test(authorEmail) || !noreply.test(committerEmail))
      )
        historyForbidden.push(`${commit.slice(0, 12)}:commit-email-policy`);
      const messageFindings = [];
      scanPolicy("COMMIT_MESSAGE", message, messageFindings);
      historyForbidden.push(...messageFindings.map((finding) => `${commit.slice(0, 12)}:${finding}`));
    }
    record(
      "reachable-history-policy-scan",
      historyForbidden.length === 0,
      historyForbidden.join(";") || `commits=${commits.length} uniqueBlobs=${scannedHistoryBlobs.size} clean`,
    );
    const selfTest = [];
    scanPolicy("docs/active-install.md", `install ./${formerArchivePrefix}0.1.0.tgz`, selfTest);
    record(
      "history-policy-detector-self-test",
      selfTest.some((finding) => finding.endsWith(":former-archive-active")),
      selfTest.length ? "forbidden historical archive prefix detected" : "detector failed",
    );
  }

  if (gate === "B") {
    const files = tracked();
    const manifests = files.filter((file) => file.endsWith("package.json"));
    const invalid = [];
    for (const file of manifests) {
      const data = JSON.parse(await readFile(path.join(root, file), "utf8"));
      if (data.private !== true || "publishConfig" in data) invalid.push(file);
    }
    record(
      "all-manifests-private",
      invalid.length === 0,
      invalid.join(",") || `${manifests.length} private manifests`,
    );
    for (const [label, args] of [
      ["root", ["run", "prepublishOnly"]],
      ["package", ["run", "prepublishOnly", "--workspace", "senior-pm"]],
    ]) {
      const result = run("npm", args);
      record(
        `intentional-prepublish-refusal-${label}`,
        result.status !== 0 &&
          `${result.stdout}${result.stderr}`.includes(
            "Publication is disabled",
          ),
        `exit=${result.status}`,
      );
    }
    const packageDirectory = path.join(evidence, "packages");
    await rm(packageDirectory, { recursive: true, force: true });
    await mkdir(packageDirectory, { recursive: true });
    const packed = run("npm", [
      "pack",
      "./packages/senior-product-manager",
      "--pack-destination",
      packageDirectory,
      "--json",
    ]);
    record(
      "npm-pack-succeeds",
      packed.status === 0,
      packed.stderr || packed.stdout,
    );
    const packData = JSON.parse(packed.stdout)[0];
    const archive = path.join(packageDirectory, packData.filename);
    await writeFile(
      path.join(evidence, "package.json"),
      JSON.stringify(
        {
          ...packData,
          archive: path.relative(root, archive),
          sha256: hash(await readFile(archive)),
        },
        null,
        2,
      ) + "\n",
    );
    const tarEntries = exact("tar", ["-tzf", archive])
      .split("\n")
      .filter(Boolean);
    const tarDetails = exact("tar", ["-tvzf", archive])
      .split("\n")
      .filter(Boolean);
    const allowedArchivePath = /^package\/(?:package\.json|README\.md|LICENSE|THIRD_PARTY_NOTICES\.md|(?:LICENSES|sbom|dist|assets|schemas)\/)/;
    const unexpectedArchiveEntries = tarEntries.filter(
      (entry) => entry !== "package/" && !allowedArchivePath.test(entry),
    );
    const archiveLinks = tarDetails.filter((entry) => /^[lh]/.test(entry));
    record(
      "exact-packed-allowlist-and-no-links",
      unexpectedArchiveEntries.length === 0 && archiveLinks.length === 0,
      JSON.stringify({ unexpectedArchiveEntries, archiveLinks, entries: packData.entryCount }),
    );
    const extractedRoot = path.join(evidence, "extracted-package");
    await rm(extractedRoot, { recursive: true, force: true });
    await mkdir(extractedRoot, { recursive: true });
    const extracted = run("tar", ["-xzf", archive, "-C", extractedRoot]);
    record("extract-exact-package", extracted.status === 0, extracted.stderr || "extracted");
    const extractedPackage = path.join(extractedRoot, "package");
    const archiveScanFailures = [];
    const packedMarkdown = [];
    const scanArchive = async (directory) => {
      for (const name of (await readdir(directory)).sort()) {
        const absolute = path.join(directory, name);
        const relative = path.relative(extractedPackage, absolute).split(path.sep).join("/");
        const info = await lstat(absolute);
        if (info.isSymbolicLink()) {
          archiveScanFailures.push(`${relative}:symlink`);
          continue;
        }
        if (info.isDirectory()) {
          await scanArchive(absolute);
          continue;
        }
        if (!info.isFile()) {
          archiveScanFailures.push(`${relative}:unsupported-entry`);
          continue;
        }
        if (relative.endsWith(".md")) packedMarkdown.push(relative);
        const bytes = await readFile(absolute);
        if (bytes.includes(0)) continue;
        const text = bytes.toString("utf8");
        const privateSample = new RegExp(["resume", "committed", "pm", "workflow"].join("-"), "i");
        const privateReport = new RegExp(["rebrand", "migration"].join("-") + "\\.md", "i");
        if (/\/home\/[A-Za-z0-9._-]+\//.test(text)) archiveScanFailures.push(`${relative}:absolute-user-path`);
        if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text)) archiveScanFailures.push(`${relative}:email`);
        if (/(?:AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{36})/.test(text)) archiveScanFailures.push(`${relative}:credential-pattern`);
        if (
          disallowedCanonicalSourceUrls(text, relative === "README.md").length ||
          privateSample.test(text) ||
          privateReport.test(text) ||
          /actions\/runs\//.test(text)
        ) archiveScanFailures.push(`${relative}:private-identifier`);
        if (/(?:^|\/)(?:auth\.json|credentials|sessions?)(?:$|[./])/i.test(relative)) archiveScanFailures.push(`${relative}:auth-session-file`);
      }
    };
    await scanArchive(extractedPackage);
    record(
      "tarball-secret-private-metadata-scan",
      archiveScanFailures.length === 0,
      archiveScanFailures.join(";") || "clean",
    );
    const packedLinkFailures = [];
    for (const file of packedMarkdown) {
      const text = await readFile(path.join(extractedPackage, file), "utf8");
      for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
        const target = match[1].split("#")[0];
        if (!target || /^(https?:|mailto:)/.test(target)) continue;
        try {
          await lstat(path.resolve(path.dirname(path.join(extractedPackage, file)), target));
        } catch {
          packedLinkFailures.push(`${file}:${target}`);
        }
      }
    }
    record(
      "packed-context-markdown-links",
      packedLinkFailures.length === 0,
      packedLinkFailures.join(",") || `${packedMarkdown.length} packed Markdown files resolve`,
    );
    const publish = run("npm", [
      "publish",
      "./packages/senior-product-manager",
      "--dry-run",
    ]);
    record(
      "npm-publish-dry-run-refuses",
      publish.status !== 0,
      `exit=${publish.status}`,
    );
    const workflowFiles = files.filter((file) =>
      file.startsWith(".github/workflows/"),
    );
    const publication = [];
    for (const file of workflowFiles) {
      const text = await readFile(path.join(root, file), "utf8");
      if (/npm\s+publish|NODE_AUTH_TOKEN|NPM_TOKEN|release:/i.test(text))
        publication.push(file);
    }
    record(
      "no-publication-workflow-or-credential",
      publication.length === 0,
      publication.join(",") || "none",
    );
  }

  if (gate === "C") {
    const packageEvidence = JSON.parse(
      await readFile(path.join(evidence, "package.json"), "utf8"),
    );
    const archive = path.join(root, packageEvidence.archive);
    const extractedPackage = path.join(evidence, "extracted-package/package");
    const packedMetafileBytes = await readFile(path.join(extractedPackage, "dist/metafile-esm.json"));
    const sourceMetafileBytes = await readFile(path.join(root, "packages/senior-product-manager/dist/metafile-esm.json"));
    record(
      "packed-metafile-matches-built-metafile",
      hash(packedMetafileBytes) === hash(sourceMetafileBytes),
      `packed=${hash(packedMetafileBytes)} built=${hash(sourceMetafileBytes)}`,
    );
    const metafile = JSON.parse(packedMetafileBytes.toString("utf8"));
    const modules = new Set();
    const unknown = [];
    for (const input of Object.keys(metafile.inputs)) {
      if (!input.includes("node_modules/")) continue;
      if (input.includes("node_modules/@opencode-ai/plugin/node_modules/zod/"))
        modules.add("zod@4.1.8");
      else if (input.includes("node_modules/@opencode-ai/plugin/"))
        modules.add("@opencode-ai/plugin@1.18.3");
      else if (input.includes("node_modules/zod/")) modules.add("zod@3.25.76");
      else if (input.includes("node_modules/jsonc-parser/"))
        modules.add("jsonc-parser@3.3.1");
      else unknown.push(input);
    }
    const expected = [
      "@opencode-ai/plugin@1.18.3",
      "jsonc-parser@3.3.1",
      "zod@3.25.76",
      "zod@4.1.8",
    ];
    record(
      "exact-metafile-module-reconciliation",
      unknown.length === 0 &&
        JSON.stringify([...modules].sort()) === JSON.stringify(expected),
      `modules=${[...modules].sort().join(",")} unknown=${unknown.length}`,
    );
    const tar = exact("tar", ["-tzf", archive]).split("\n").filter(Boolean);
    const required = [
      "package/THIRD_PARTY_NOTICES.md",
      "package/LICENSES/zod-3.25.76-LICENSE",
      "package/LICENSES/jsonc-parser-3.3.1-LICENSE.md",
      "package/LICENSES/opencode-plugin-1.18.3-LICENSE",
      "package/LICENSES/zod-4.1.8-LICENSE",
    ];
    record(
      "required-notices-and-license-texts-packed",
      required.every((file) => tar.includes(file)),
      required.filter((file) => !tar.includes(file)).join(",") || "all present",
    );
    const sboms = tar.filter((file) => file.endsWith(".cdx.json"));
    record(
      "exactly-one-packed-sbom",
      sboms.length === 1 && sboms[0] === "package/sbom/senior-pm.cdx.json",
      sboms.join(","),
    );
    const packedSbomBytes = await readFile(path.join(extractedPackage, "sbom/senior-pm.cdx.json"));
    const sourceSbomBytes = await readFile(path.join(root, "packages/senior-product-manager/sbom/senior-pm.cdx.json"));
    record(
      "packed-sbom-matches-reviewed-source",
      hash(packedSbomBytes) === hash(sourceSbomBytes),
      `sha256=${hash(packedSbomBytes)}`,
    );
    const sbom = JSON.parse(packedSbomBytes.toString("utf8"));
    const components = sbom.components
      .map((component) => `${component.name}@${component.version}`)
      .sort();
    record(
      "sbom-matches-bundled-components",
      JSON.stringify(components) === JSON.stringify(expected),
      components.join(","),
    );
    const lock = JSON.parse(await readFile(path.join(root, "package-lock.json"), "utf8"));
    const lockComponents = [
      `@opencode-ai/plugin@${lock.packages["node_modules/@opencode-ai/plugin"]?.version}`,
      `jsonc-parser@${lock.packages["node_modules/jsonc-parser"]?.version}`,
      `zod@${lock.packages["node_modules/zod"]?.version}`,
      `zod@${lock.packages["node_modules/@opencode-ai/plugin/node_modules/zod"]?.version}`,
    ].sort();
    record(
      "lockfile-components-match-packed-metafile-and-sbom",
      JSON.stringify(lockComponents) === JSON.stringify(expected),
      lockComponents.join(","),
    );
    const notices = await readFile(path.join(extractedPackage, "THIRD_PARTY_NOTICES.md"), "utf8");
    record(
      "packed-notices-name-every-bundled-component",
      expected.every((component) => {
        const index = component.lastIndexOf("@");
        return notices.includes(component.slice(0, index)) && notices.includes(component.slice(index + 1));
      }),
      expected.join(","),
    );
  }

  if (gate === "D") {
    const audit = run("npm", ["audit", "--audit-level=high", "--json"]);
    const auditReport = JSON.parse(audit.stdout || "{}");
    const vulnerabilityCounts = auditReport.metadata?.vulnerabilities ?? {};
    const findings = Object.values(auditReport.vulnerabilities ?? {}).map(
      (finding) => ({
        name: finding.name,
        severity: finding.severity,
        via: (finding.via ?? [])
          .filter((item) => typeof item === "object")
          .map((item) => ({ title: item.title, url: item.url })),
        fixAvailable: finding.fixAvailable,
      }),
    );
    record(
      "dependency-vulnerability-gate",
      audit.status === 0 &&
        !vulnerabilityCounts.high &&
        !vulnerabilityCounts.critical,
      JSON.stringify({
        exit: audit.status,
        counts: vulnerabilityCounts,
        findings,
      }),
    );
    const buildHashes = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      const built = run("npm", ["run", "build"]);
      if (built.status !== 0) throw new Error(`build ${attempt + 1} failed`);
      const files = [];
      const walk = async (directory) => {
        for (const name of (await readdir(directory)).sort()) {
          const absolute = path.join(directory, name),
            info = await (await import("node:fs/promises")).stat(absolute);
          if (info.isDirectory()) await walk(absolute);
          else
            files.push(
              `${path.relative(root, absolute).split(path.sep).join("/")} ${hash(await readFile(absolute))}`,
            );
        }
      };
      await walk(path.join(root, "packages/senior-product-manager/dist"));
      buildHashes.push(hash(Buffer.from(files.join("\n"))));
    }
    record(
      "two-deterministic-builds",
      buildHashes[0] === buildHashes[1],
      buildHashes.join(","),
    );
    const schemaRoot = path.join(
      root,
      "packages/senior-product-manager/schemas",
    );
    const spec = JSON.parse(
      await readFile(
        path.join(schemaRoot, "senior-pm-spec.schema.json"),
        "utf8",
      ),
    );
    const design = JSON.parse(
      await readFile(
        path.join(schemaRoot, "senior-pm-design-review.schema.json"),
        "utf8",
      ),
    );
    const idless = [
      "senior-pm-config.schema.json",
      "senior-pm-handoff.schema.json",
      "senior-pm-manifest.schema.json",
      "senior-pm-prior-artifact.schema.json",
    ];
    record(
      "neutral-schema-and-idless-contract",
      spec.$id === "urn:senior-pm:schema:spec:1.0.0" &&
        design.$id === "urn:senior-pm:schema:design-review:1.0.0" &&
        (
          await Promise.all(
            idless.map(
              async (file) =>
                !(
                  "$id" in
                  JSON.parse(
                    await readFile(path.join(schemaRoot, file), "utf8"),
                  )
                ),
            ),
          )
        ).every(Boolean),
      "canonical=2 idless=4",
    );
    const sample = path.join(
      root,
      "examples/synthetic-public/senior-pm/synthetic-bookmark-export.r001.json",
    );
    const fixture = path.join(
      root,
      "packages/senior-product-manager/test/fixtures/compatibility/legacy-byte/fixture.json",
    );
    record(
      "separate-synthetic-sample-and-fixture",
      hash(await readFile(sample)) !== hash(await readFile(fixture)),
      `sample=${hash(await readFile(sample))} fixture=${hash(await readFile(fixture))}`,
    );
    const sampleSpec = JSON.parse(await readFile(sample, "utf8"));
    record(
      "synthetic-sample-review-and-handoff-coherence",
      sampleSpec.status === "Ready for design review" &&
        sampleSpec.designReviewRequired === true &&
        sampleSpec.designApproved === false &&
        sampleSpec.handoffEligible === false &&
        /do not implement or hand it off/i.test(sampleSpec.handoffInstructions),
      JSON.stringify({
        status: sampleSpec.status,
        designReviewRequired: sampleSpec.designReviewRequired,
        designApproved: sampleSpec.designApproved,
        handoffEligible: sampleSpec.handoffEligible,
      }),
    );
    const linkFailures = [];
    for (const file of tracked().filter((file) => file.endsWith(".md"))) {
      const text = await readFile(path.join(root, file), "utf8");
      for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
        const target = match[1].split("#")[0];
        if (!target || /^(https?:|mailto:)/.test(target)) continue;
        const absolute = path.resolve(
          path.dirname(path.join(root, file)),
          target,
        );
        try {
          await (await import("node:fs/promises")).access(absolute);
        } catch {
          linkFailures.push(`${file}:${target}`);
        }
      }
    }
    record(
      "accessible-relative-markdown-links",
      linkFailures.length === 0,
      linkFailures.join(",") || "all resolve",
    );
    const workflow = await readFile(
      path.join(root, ".github/workflows/ci.yml"),
      "utf8",
    );
    record(
      "immutable-read-only-ci-definition",
      workflow.includes(
        "actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0",
      ) &&
        workflow.includes(
          "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020",
        ) &&
        workflow.includes("contents: read") &&
        workflow.includes("persist-credentials: false") &&
        workflow.includes("gate:a:hosted") &&
        !workflow.includes("pull_request_target") &&
        !workflow.includes("cache:"),
      "full SHA pins, read-only permissions, no persisted credentials, hosted Gate A mode, no privileged trigger/cache",
    );
    const matrix = JSON.parse(
      await readFile(path.join(evidence, "opencode-matrix.json"), "utf8"),
    );
    record(
      "exact-opencode-local-matrix",
      ["1.17.20", "1.18.3"].every(
        (version) => matrix[version]?.verdict === "PASS",
      ),
      JSON.stringify(matrix),
    );
  }
  await report("PASS");
  console.log(`Gate ${gate}: PASS`);
} catch (error) {
  checks.push({
    name: "gate-exception",
    ok: false,
    output: error instanceof Error ? error.message : String(error),
    exceptions: [],
  });
  await report("FAIL");
  throw error;
}
