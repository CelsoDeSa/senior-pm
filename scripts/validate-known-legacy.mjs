import { createHash } from "node:crypto";
import { cp, chmod, lstat, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const sourceIndex = process.argv.indexOf("--source-config");
if (sourceIndex === -1 || !process.argv[sourceIndex + 1]) throw new Error("--source-config is required");
const sourceConfig = path.resolve(process.argv[sourceIndex + 1]);
const packageRoot = path.join(root, "packages/senior-product-manager");
const fingerprintPath = path.join(packageRoot, "assets/compatibility/known-legacy-0.1.0-fingerprint.json");
const evidenceRoot = path.join(root, ".candidate-evidence");
const workRoot = path.join(evidenceRoot, "known-legacy-work");
const reportPath = path.join(evidenceRoot, "known-legacy-validation.json");
const publicPath = path.join(root, "docs/known-legacy-validation.md");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function stable(value) { return JSON.stringify(value); }

async function inventory(directory) {
  const rows = [];
  const walk = async (current) => {
    for (const entry of (await readdir(current, { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = path.join(current, entry.name);
      const relative = path.relative(directory, absolute).split(path.sep).join("/");
      const stat = await lstat(absolute);
      if (stat.isSymbolicLink()) rows.push({ path: relative, type: "symlink", mode: stat.mode & 0o777, target: await (await import("node:fs/promises")).readlink(absolute) });
      else if (stat.isDirectory()) { rows.push({ path: relative, type: "directory", mode: stat.mode & 0o777 }); await walk(absolute); }
      else if (stat.isFile()) rows.push({ path: relative, type: "file", mode: stat.mode & 0o777, sha256: sha256(await readFile(absolute)) });
      else rows.push({ path: relative, type: "unsupported", mode: stat.mode & 0o777 });
    }
  };
  await walk(directory);
  const ordered = rows.sort((left, right) => left.path.localeCompare(right.path));
  return { entries: ordered, rootSha256: sha256(Buffer.from(stable(ordered))) };
}

async function prepare(label) {
  const project = path.join(workRoot, label);
  const config = path.join(project, ".opencode");
  await mkdir(path.join(config, "plugins"), { recursive: true });
  await cp(path.join(sourceConfig, "plugins/senior-product-manager.js"), path.join(config, "plugins/senior-product-manager.js"));
  await cp(path.join(sourceConfig, "senior-pm-runtime"), path.join(config, "senior-pm-runtime"), { recursive: true });
  return { project, config };
}

await rm(workRoot, { recursive: true, force: true });
await mkdir(workRoot, { recursive: true });
await mkdir(evidenceRoot, { recursive: true });

const fingerprintBytes = await readFile(fingerprintPath);
const fingerprintSha256 = sha256(fingerprintBytes);
const fingerprint = JSON.parse(fingerprintBytes.toString("utf8"));
const legacyModule = await import(`${pathToFileURL(path.join(packageRoot, "dist/installer/legacy-migration.js")).href}?known=${Date.now()}`);
const installer = await import(`${pathToFileURL(path.join(packageRoot, "dist/installer/index.js")).href}?known=${Date.now()}`);

await legacyModule.verifyKnownLegacyInstall(sourceConfig, fingerprint);
const sourceOwned = await inventory(path.join(sourceConfig, "senior-pm-runtime"));
const sourceWrapperSha256 = sha256(await readFile(path.join(sourceConfig, "plugins/senior-product-manager.js")));

const success = await prepare("success");
await writeFile(path.join(success.config, "unrelated-sentinel.txt"), "synthetic unrelated sentinel\n");
const successBefore = await inventory(success.config);
await legacyModule.verifyKnownLegacyInstall(success.config, fingerprint);
const migrated = await installer.install("project", success.project, { platform: "linux", packageRoot });
if (migrated.migratedFrom !== "0.1.0" || migrated.cleanupRequired || migrated.recoveryRequired) throw new Error("Complete known legacy migration did not commit cleanly");
const diagnosis = await installer.diagnoseUninstall("project", success.project, { platform: "linux", packageRoot });
if (diagnosis.blockers.length) throw new Error(`Neutral verification failed: ${diagnosis.blockers.join("; ")}`);
const neutralWrapper = await readFile(path.join(success.config, "plugins/senior-product-manager.js"), "utf8");
if (!neutralWrapper.includes("senior-pm.plugin")) throw new Error("Neutral wrapper identity was not installed");
if ((await readFile(path.join(success.config, "unrelated-sentinel.txt"), "utf8")) !== "synthetic unrelated sentinel\n") throw new Error("Unrelated sentinel changed");
const successAfter = await inventory(success.config);

const faults = [];
for (const stage of ["legacy-migration:after-quarantine", "legacy-migration:after-neutral-install-before-commit"]) {
  const target = await prepare(`fault-${faults.length + 1}`);
  await writeFile(path.join(target.config, "unrelated-sentinel.txt"), "synthetic unrelated sentinel\n");
  const before = await inventory(target.config);
  let refused = false;
  try {
    await installer.install("project", target.project, { platform: "linux", packageRoot, hook: (point) => { if (point === stage) throw new Error(`injected:${stage}`); } });
  } catch (error) {
    refused = String(error).includes(`injected:${stage}`);
  }
  const after = await inventory(target.config);
  if (!refused || before.rootSha256 !== after.rootSha256) throw new Error(`Complete-shape restoration failed at ${stage}`);
  faults.push({ stage, beforeRootSha256: before.rootSha256, afterRootSha256: after.rootSha256, exactRestoration: true });
}

const refusals = [];
for (const mutation of ["payload", "mode", "extra", "version", "symlink"]) {
  const target = await prepare(`refusal-${mutation}`);
  if (mutation === "payload") await writeFile(path.join(target.config, "senior-pm-runtime/0.1.0/dist/plugin.js"), "changed");
  if (mutation === "mode") await chmod(path.join(target.config, "plugins/senior-product-manager.js"), 0o644);
  if (mutation === "extra") await writeFile(path.join(target.config, "senior-pm-runtime/0.1.0/unexpected"), "unexpected");
  if (mutation === "version") await mkdir(path.join(target.config, "senior-pm-runtime/0.2.0"));
  if (mutation === "symlink") await symlink("dist/plugin.js", path.join(target.config, "senior-pm-runtime/0.1.0/link"));
  const before = await inventory(target.config);
  let refused = false;
  try { await installer.install("project", target.project, { platform: "linux", packageRoot }); }
  catch (error) { refused = /Legacy migration refused/.test(String(error)); }
  const after = await inventory(target.config);
  const quarantine = (await readdir(target.config)).filter((name) => name.startsWith(".senior-pm-legacy-migration-"));
  if (!refused || before.rootSha256 !== after.rootSha256 || quarantine.length) throw new Error(`Complete-shape refusal failed for ${mutation}`);
  refusals.push({ mutation, beforeRootSha256: before.rootSha256, afterRootSha256: after.rootSha256, refusedBeforeMutation: true });
}

const report = {
  schemaVersion: 1,
  date: "2026-07-19",
  source: "retained-local-exact-installation",
  sourcePathRecorded: false,
  fingerprint: { sha256: fingerprintSha256, runtimeEntries: fingerprint.entries.length, zeroSymlinks: true, zeroExtraRuntimeEntries: true },
  sourceVerification: { wrapperSha256: sourceWrapperSha256, runtimeInventory: sourceOwned, verdict: "PASS" },
  productionMigration: { fingerprintOverrideUsed: false, result: migrated, beforeInventory: successBefore, afterInventory: successAfter, neutralDiagnosis: "PASS", unrelatedSentinelPreserved: true },
  faultRestoration: faults,
  refusalBeforeMutation: refusals,
  verdict: "PASS"
};
await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");

const publicAttestation = `# Complete known legacy installation validation

This bounded public-safe attestation records execution against the complete known frozen legacy \`0.1.0\` installation represented by the shipped fingerprint. The retained source location and private operational details are intentionally omitted.

## Binding

- Shipped fingerprint SHA-256: \`${fingerprintSha256}\`
- Frozen runtime inventory entries: ${fingerprint.entries.length}
- Wrapper SHA-256 matched the shipped fingerprint: yes
- Required shape: one runtime version, zero symlinks, zero extra runtime entries

## Executed result

- The retained complete installation matched the shipped fingerprint before copying to a disposable project.
- Migration ran through the exported production \`install()\` path with no fingerprint override.
- The neutral installation passed verified diagnosis and retained an unrelated synthetic sentinel byte-for-byte.
- Pre-commit faults at both post-quarantine and post-neutral-install boundaries restored the complete legacy tree exactly.
- Complete-shape payload, mode, extra-entry, extra-version, and symlink mutations each refused before migration mutation and created no quarantine.

The detailed before/after inventories and hashes remain in ignored local evidence at \`.candidate-evidence/known-legacy-validation.json\`. This attestation contains no retained source path or private file content and does not authorize downgrade or any legacy shape beyond the frozen fingerprint.
`;
await writeFile(publicPath, publicAttestation);
await rm(workRoot, { recursive: true, force: true });
console.log(`Complete known legacy validation: PASS (${fingerprint.entries.length} runtime entries)`);
