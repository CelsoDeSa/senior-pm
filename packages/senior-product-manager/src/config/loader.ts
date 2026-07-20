import { open, type FileHandle } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parse, printParseErrorCode } from "jsonc-parser";
import { ConfigurationError } from "../shared/errors.js";
import { configDocumentSchema, DEFAULT_SETTINGS, type SeniorPmSettings } from "./schema.js";

type Trust = "operator" | "project";
export interface LoadConfigOptions { projectRoot: string; tupleOptions?: unknown; env?: NodeJS.ProcessEnv; platform?: NodeJS.Platform; homeDir?: string; openFile?: (file:string,flags:string)=>Promise<FileHandle>; }
const CAPABILITIES = ["allow_external_research", "allow_repository_history", "allow_programmatic_invocation"] as const;
const ADDITIVE = ["additional_non_goals", "required_specification_sections", "tool_restrictions", "handoff_candidates"] as const;
function configHome(platform: NodeJS.Platform, env: NodeJS.ProcessEnv, home: string) { return platform === "win32" ? (env.APPDATA || path.join(home, "AppData", "Roaming")) : (env.XDG_CONFIG_HOME || path.join(home, ".config")); }
async function readDocument(file: string, required = false, openFile:((file:string,flags:string)=>Promise<FileHandle>)=((file,flags)=>open(file,flags))): Promise<unknown | undefined> {
  let handle:FileHandle|undefined;try { handle=await openFile(file,"r");const stat=await handle.stat();if(!stat.isFile())throw new ConfigurationError("configuration is not a regular file",file);if(stat.size>1_000_000)throw new ConfigurationError("configuration exceeds 1000000 bytes",file);const buffer=Buffer.alloc(stat.size);let offset=0;while(offset<buffer.length){const read=await handle.read(buffer,offset,buffer.length-offset,offset);if(!read.bytesRead)break;offset+=read.bytesRead;}const text=buffer.subarray(0,offset).toString("utf8"); const errors: { error: number; offset: number; length: number }[] = []; const value = parse(text, errors, { allowTrailingComma: true, disallowComments: false }); if (errors.length) throw new ConfigurationError(`${printParseErrorCode(errors[0]!.error)} at offset ${errors[0]!.offset}`, file); return value; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT" && !required) return undefined; if (error instanceof ConfigurationError) throw error; throw new ConfigurationError((error as Error).message, file); }finally{await handle?.close().catch(()=>undefined);}
}
function validate(input: unknown, source: string): SeniorPmSettings { const result = configDocumentSchema.safeParse(input); if (!result.success) throw new ConfigurationError(result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; "), source); return result.data.senior_pm; }
function apply(current: SeniorPmSettings, next: SeniorPmSettings, trust: Trust, source: string): SeniorPmSettings {
  if (trust === "project" && (next.invocation_target !== undefined || next.allow_programmatic_invocation === true)) throw new ConfigurationError("invocation_target and invocation authorization are operator-only", source);
  const merged: SeniorPmSettings = { ...current, ...next, context_limits: { ...current.context_limits, ...next.context_limits } };
  for (const key of CAPABILITIES) if (trust === "project" && next[key] === true && current[key] !== true) merged[key] = false;
  for (const key of ADDITIVE) merged[key] = [...new Set([...(current[key] ?? []), ...(next[key] ?? [])])] as never;
  merged.denied_permissions = { ...(current.denied_permissions ?? {}), ...(next.denied_permissions ?? {}) };
  const curLimits = current.context_limits ?? {}; const newLimits = next.context_limits ?? {}; merged.context_limits = Object.fromEntries(Object.keys({ ...curLimits, ...newLimits }).map(k => [k, Math.min((curLimits as any)[k] ?? Infinity, (newLimits as any)[k] ?? Infinity)]));
  merged.require_design_review_for_ui = current.require_design_review_for_ui !== false || next.require_design_review_for_ui !== false;
  merged.permission_profile = current.permission_profile === "strict" || next.permission_profile === "strict" ? "strict" : "restricted";
  return merged;
}
export async function loadConfig(options: LoadConfigOptions): Promise<SeniorPmSettings> {
  const env = options.env ?? process.env; const home = options.homeDir ?? os.homedir(); const platform = options.platform ?? process.platform;
  let effective: SeniorPmSettings = structuredClone(DEFAULT_SETTINGS);
  const sources: Array<[unknown | undefined, string, Trust]> = [];
  const userBase = path.join(configHome(platform, env, home), "opencode", "senior-pm"); const projectBase = path.join(path.resolve(options.projectRoot), ".opencode", "senior-pm");
  for (const [base, trust] of [[userBase, "operator"], [projectBase, "project"]] as const) { sources.push([await readDocument(`${base}.jsonc`,false,options.openFile) ?? await readDocument(`${base}.json`,false,options.openFile), base, trust]); }
  if (env.SENIOR_PM_CONFIG) sources.push([await readDocument(path.resolve(env.SENIOR_PM_CONFIG), true,options.openFile), "SENIOR_PM_CONFIG", "operator"]);
  if (env.SENIOR_PM_CONFIG_JSON) { if (Buffer.byteLength(env.SENIOR_PM_CONFIG_JSON) > 1_000_000) throw new ConfigurationError("inline configuration exceeds 1000000 bytes", "SENIOR_PM_CONFIG_JSON"); const errors: any[] = []; const inline = parse(env.SENIOR_PM_CONFIG_JSON, errors, { allowTrailingComma: true, disallowComments: false }); if (errors.length) throw new ConfigurationError("invalid inline JSON/JSONC", "SENIOR_PM_CONFIG_JSON"); sources.push([inline, "SENIOR_PM_CONFIG_JSON", "operator"]); }
  sources.push([options.tupleOptions, "plugin tuple options", "project"]);
  for (const [document, source, trust] of sources) if (document !== undefined) effective = apply(effective, validate(document, source), trust, source);
  return effective;
}
