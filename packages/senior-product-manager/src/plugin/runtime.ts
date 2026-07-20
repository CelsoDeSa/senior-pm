import { lstat, realpath, stat } from "node:fs/promises";
import path from "node:path";
import type { Config, Hooks, Plugin, PluginInput, PluginOptions } from "@opencode-ai/plugin";
import { loadConfig, type SeniorPmSettings } from "../config/index.js";
import { AGENT_ID } from "../shared/constants.js";
import { createRuntimeTools } from "../tools/runtime.js";
import { HandoffNonceStore } from "../workflow/nonce.js";
import { loadAsset } from "./assets.js";
import { SeniorPMConfigurationError } from "./errors.js";
import { PinnedRepositoryRoot } from "../shared/secure-fs.js";

const COMMANDS = ["pm-spec", "pm-revise", "pm-validate", "pm-handoff"] as const;
async function selectedProjectRoot(input: PluginInput) {
  const directoryStat = await lstat(input.directory);
  if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) throw new SeniorPMConfigurationError("Plugin directory must be a real directory");
  const directory = await realpath(input.directory), candidate = input.worktree;
  if (!candidate) return directory;
  try {
    const candidateStat = await lstat(candidate);
    if (!candidateStat.isDirectory() || candidateStat.isSymbolicLink()) return directory;
    const worktree = await realpath(candidate);
    if (worktree === path.parse(worktree).root || (directory !== worktree && !directory.startsWith(`${worktree}${path.sep}`))) return directory;
    const git = path.join(worktree, ".git"), gitStat = await lstat(git);
    if (!gitStat.isDirectory() || gitStat.isSymbolicLink() || await realpath(git) !== git) return directory;
    return worktree;
  } catch { return directory; }
}
function permissions(settings: SeniorPmSettings) {
  const rules: Record<string, "allow" | "ask" | "deny"> = { "*": "deny", external_directory: "deny", edit: "deny", bash: "deny", task: "deny", read: "deny", glob: "deny", grep: "deny", list: "deny", question: "allow", skill: "allow", senior_pm_config: "allow", senior_pm_discover: "allow", senior_pm_write_spec: "allow", senior_pm_validate_spec: "allow", senior_pm_handoff: "ask", senior_pm_approval_sidecar:"ask" };
  if (settings.allow_external_research) { rules.webfetch = "allow"; rules.websearch = "allow"; }
  for (const denied of settings.tool_restrictions ?? []) rules[denied] = "deny";
  for (const denied of Object.keys(settings.denied_permissions ?? {})) rules[denied] = "deny";
  rules.edit = rules.bash = rules.task = rules.external_directory = "deny";
  return rules;
}
export async function createSeniorPMRuntime(input: PluginInput, options?: PluginOptions): Promise<Hooks> {
  const root = await selectedProjectRoot(input), identity = await stat(root); const settings = await loadConfig({ projectRoot: root, tupleOptions: options });
  if (!settings.enabled) return {};
  const agentAsset = await loadAsset("agents/senior-pm.md"); const commandAssets = await Promise.all(COMMANDS.map(id => loadAsset(`commands/${id}.md`))); const nonce = new HandoffNonceStore(); let observedConfig: any = {};
  const pinnedRoot = process.platform === "linux" ? await PinnedRepositoryRoot.open(root) : undefined;
  let rootClosed=false; const closeRoot=async()=>{if(!rootClosed){rootClosed=true;await pinnedRoot?.close();}};
  const hooks: Hooks = {
    async config(config: Config) {
      Object.assign(observedConfig, config);
      const mutable = config as any; mutable.agent ??= {}; mutable.command ??= {};
      if (Object.prototype.hasOwnProperty.call(mutable.agent, AGENT_ID)) { await closeRoot(); throw new SeniorPMConfigurationError(`Agent collision: ${AGENT_ID}`); }
      for (const id of COMMANDS) if (Object.prototype.hasOwnProperty.call(mutable.command, id)) { await closeRoot(); throw new SeniorPMConfigurationError(`Command collision: ${id}`); }
      const agent: any = { description: agentAsset.frontmatter.description, mode: "subagent", prompt: agentAsset.body, permission: permissions(settings) };
      if (settings.model && settings.model !== "inherit") agent.model = settings.model;
      if (settings.effort && settings.effort !== "inherit") agent.effort = settings.effort;
      mutable.agent[AGENT_ID] = agent;
      COMMANDS.forEach((id, index) => { const asset = commandAssets[index]!; mutable.command[id] = { description: asset.frontmatter.description, agent: AGENT_ID, subtask: true, template: asset.body }; });
    },
    tool: createRuntimeTools({ root, ...(pinnedRoot?{pinnedRoot}:{}), rootIdentity: { dev: identity.dev, ino: identity.ino }, settings, client: input.client as any, nonce, hostConfig: observedConfig }),
    async dispose() { await closeRoot(); },
    async "command.execute.before"(event, output) {
      if (event.command !== "pm-handoff") return;
      const artifact = /(?:^|\s)--artifact-base(?:=|\s+)([a-z0-9]+(?:-[a-z0-9]+)*\.r\d+)(?=\s|$)/.exec(event.arguments)?.[1];
      const target = /(?:^|\s)--target(?:=|\s+)([A-Za-z0-9_.-]+)(?=\s|$)/.exec(event.arguments)?.[1];
      if (artifact && target && settings.invocation_target === target) nonce.issue(event.sessionID, { artifactBase: artifact, target });
      void output;
    }
  };
  return hooks;
}
export const SeniorProductManagerPlugin: Plugin = createSeniorPMRuntime;
