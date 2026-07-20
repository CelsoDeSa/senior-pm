import agentRaw from "../../assets/agents/senior-pm.md?raw";
import handoffRaw from "../../assets/commands/pm-handoff.md?raw";
import reviseRaw from "../../assets/commands/pm-revise.md?raw";
import specRaw from "../../assets/commands/pm-spec.md?raw";
import validateRaw from "../../assets/commands/pm-validate.md?raw";

export interface ParsedAsset { frontmatter: Record<string, unknown>; body: string; raw: string }
function scalar(value: string): string | boolean { const v = value.trim(); if (v === "true") return true; if (v === "false") return false; return v.replace(/^(["'])(.*)\1$/, "$2"); }
export function parseAsset(raw: string): ParsedAsset {
  const normalized = raw.replace(/\r\n?/g, "\n"); const match = normalized.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error("Packaged asset has invalid frontmatter boundaries");
  const frontmatter: Record<string, unknown> = {}; let map: Record<string, unknown> | undefined;
  for (const line of match[1]!.split("\n")) { const nested=line.match(/^  (?:"([A-Za-z0-9_*.-]+)"|([A-Za-z0-9_*.-]+)):\s*(.+)$/);if(nested&&map){map[(nested[1]??nested[2])!]=scalar(nested[3]!);continue;}const top=line.match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);if(!top)throw new Error("Packaged asset contains unsupported frontmatter");if(!top[2]){map={};frontmatter[top[1]!]=map;}else{map=undefined;frontmatter[top[1]!]=scalar(top[2]);} }
  return { frontmatter, body: match[2]!.replace(/^\n/, ""), raw: normalized };
}
const bundled:Record<string,string>={"agents/senior-pm.md":agentRaw,"commands/pm-handoff.md":handoffRaw,"commands/pm-revise.md":reviseRaw,"commands/pm-spec.md":specRaw,"commands/pm-validate.md":validateRaw};
export async function loadAsset(relative:string){const raw=bundled[relative];if(raw===undefined)throw new Error(`Unknown bundled asset: ${relative}`);return parseAsset(raw);}
export function bundledAssetText(relative:string){const raw=bundled[relative];if(raw===undefined)throw new Error(`Unknown bundled asset: ${relative}`);return raw.replace(/\r\n?/g,"\n");}
