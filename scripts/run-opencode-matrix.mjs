import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const packageRoot = path.join(root, "packages/senior-product-manager");
const evidenceRoot = path.join(root, ".candidate-evidence");
const versions = ["1.17.20", "1.18.3"];
const toolIDs = [
  "senior_pm_config",
  "senior_pm_discover",
  "senior_pm_write_spec",
  "senior_pm_validate_spec",
  "senior_pm_handoff",
];
const commandIDs = ["pm-spec", "pm-revise", "pm-validate", "pm-handoff"];

function execute(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    ...options,
  }).trim();
}

function opencode(version, host, env, args) {
  return execute(
    "npm",
    [
      "exec",
      "--yes",
      `--package=opencode-ai@${version}`,
      "--",
      "opencode",
      ...args,
    ],
    {
      cwd: host,
      env: { ...process.env, ...env },
    },
  );
}

function parseToolResult(output) {
  const envelope = JSON.parse(output);
  const result = envelope.result;
  if (typeof result === "string") return JSON.parse(result);
  if (typeof result?.output === "string") return JSON.parse(result.output);
  return result;
}

await mkdir(evidenceRoot, { recursive: true });
const workspace = await mkdtemp(
  path.join(os.tmpdir(), "senior-pm-opencode-matrix-"),
);
const matrix = {};

try {
  const packDirectory = path.join(workspace, "pack");
  const extractDirectory = path.join(workspace, "extract");
  await mkdir(packDirectory);
  await mkdir(extractDirectory);
  const packed = JSON.parse(
    execute("npm", [
      "pack",
      packageRoot,
      "--pack-destination",
      packDirectory,
      "--json",
    ]),
  )[0];
  execute("tar", [
    "-xf",
    path.join(packDirectory, packed.filename),
    "-C",
    extractDirectory,
  ]);
  const extractedPackage = path.join(extractDirectory, "package");
  const installer = await import(
    pathToFileURL(path.join(extractedPackage, "dist/installer/index.js")).href
  );
  const sample = JSON.parse(
    await readFile(
      path.join(
        root,
        "examples/synthetic-public/senior-pm/synthetic-bookmark-export.r001.json",
      ),
      "utf8",
    ),
  );
  for (const computed of [
    "designApproved",
    "designReviewRequired",
    "evaluationPolicy",
    "handoffEligible",
    "productContentHash",
    "status",
    "statusReason",
    "validationFailures",
  ])
    delete sample[computed];
  sample.interfaceImpact = "none";
  delete sample.contentChangesPublicBrand;

  for (const version of versions) {
    const versionRoot = path.join(workspace, version);
    const host = path.join(versionRoot, "host");
    const home = path.join(versionRoot, "home");
    const configHome = path.join(versionRoot, "config");
    const opencodeConfig = path.join(configHome, "opencode");
    await mkdir(host, { recursive: true });
    await mkdir(home, { recursive: true });
    await mkdir(opencodeConfig, { recursive: true });
    const env = {
      HOME: home,
      XDG_CONFIG_HOME: configHome,
      OPENCODE_CONFIG_DIR: opencodeConfig,
    };

    await installer.install("project", host, {
      platform: "linux",
      packageRoot: extractedPackage,
    });
    await writeFile(
      path.join(host, "opencode.json"),
      JSON.stringify({
        plugin: ["./.opencode/plugins/senior-product-manager.js"],
      }) + "\n",
    );

    const reportedVersion = opencode(version, host, env, ["--version"]);
    if (reportedVersion !== version)
      throw new Error(`OpenCode ${version} reported ${reportedVersion}`);

    const config = JSON.parse(
      opencode(version, host, env, ["debug", "config"]),
    );
    const agent = JSON.parse(
      opencode(version, host, env, ["debug", "agent", "senior-pm"]),
    );
    const registeredTools = toolIDs.filter((id) =>
      Object.hasOwn(agent.tools ?? {}, id),
    );
    const registeredCommands = commandIDs.filter((id) =>
      Object.hasOwn(config.command ?? {}, id),
    );
    if (registeredTools.length !== toolIDs.length)
      throw new Error(`OpenCode ${version} did not register all tools`);
    if (registeredCommands.length !== commandIDs.length)
      throw new Error(`OpenCode ${version} did not register all commands`);

    const configured = parseToolResult(
      opencode(version, host, env, [
        "debug",
        "agent",
        "senior-pm",
        "--tool",
        "senior_pm_config",
        "--params",
        "{}",
      ]),
    );
    const discoveryExecution = opencode(version, host, env, [
      "debug",
      "agent",
      "senior-pm",
      "--tool",
      "senior_pm_discover",
      "--params",
      "{}",
    ]);
    const written = parseToolResult(
      opencode(version, host, env, [
        "debug",
        "agent",
        "senior-pm",
        "--tool",
        "senior_pm_write_spec",
        "--params",
        JSON.stringify({ input: sample }),
      ]),
    );
    const validated = parseToolResult(
      opencode(version, host, env, [
        "debug",
        "agent",
        "senior-pm",
        "--tool",
        "senior_pm_validate_spec",
        "--params",
        JSON.stringify({ artifactBase: written.artifactBase }),
      ]),
    );
    const handoff = parseToolResult(
      opencode(version, host, env, [
        "debug",
        "agent",
        "senior-pm",
        "--tool",
        "senior_pm_handoff",
        "--params",
        JSON.stringify({ artifactBase: written.artifactBase }),
      ]),
    );
    if (!validated.valid)
      throw new Error(
        `OpenCode ${version} did not validate the committed specification`,
      );
    if (handoff.mode !== "manual")
      throw new Error(`OpenCode ${version} did not preserve manual handoff`);

    await installer.uninstall("project", host, {
      platform: "linux",
      packageRoot: extractedPackage,
    });
    let wrapperRemoved = false;
    try {
      await readFile(
        path.join(host, ".opencode/plugins/senior-product-manager.js"),
      );
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      wrapperRemoved = true;
    }
    if (!wrapperRemoved)
      throw new Error(`OpenCode ${version} wrapper remained after uninstall`);

    matrix[version] = {
      verdict: "PASS",
      executable: `opencode-ai@${version}`,
      reportedVersion,
      package: {
        filename: packed.filename,
        shasum: packed.shasum,
        integrity: packed.integrity,
      },
      checks: {
        projectInstall: "PASS",
        agentRegistration: config.agent?.["senior-pm"] ? "PASS" : "FAIL",
        commandRegistration: registeredCommands,
        toolRegistration: registeredTools,
        configuration:
          configured.pluginVersion === "0.1.0" && configured.enabled === true
            ? "PASS"
            : "FAIL",
        discovery: discoveryExecution.includes("senior_pm_discover")
          ? "PASS"
          : "FAIL",
        specificationWrite: written.artifactBase,
        committedValidation: "PASS",
        manualHandoff: "PASS",
        projectUninstallAndRemoval: "PASS",
      },
      boundedCoverage: {
        exactMigrationRefusalRestoration: "aggregate automated test suite",
        interactivePermissionUI: "not exercised",
        explicitTargetChildSession: "not exercised",
        hostedCI: "pending separate authorization",
      },
    };
    if (Object.values(matrix[version].checks).includes("FAIL"))
      throw new Error(
        `OpenCode ${version} matrix contains a failed check: ${JSON.stringify(matrix[version].checks)}`,
      );
  }

  await writeFile(
    path.join(evidenceRoot, "opencode-matrix.json"),
    JSON.stringify(matrix, null, 2) + "\n",
  );
  console.log(`OpenCode matrix: PASS (${versions.join(", ")})`);
} finally {
  await rm(workspace, { recursive: true, force: true });
}
