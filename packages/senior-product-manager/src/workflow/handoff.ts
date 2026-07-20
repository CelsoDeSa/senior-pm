export interface StandardClient { app?: { agents?: () => Promise<any> }; session?: { create?: (input: unknown) => Promise<any>; prompt?: (input: unknown) => Promise<any>; delete?: (input: unknown) => Promise<any>; abort?: (input: unknown) => Promise<any> } }
export const ADVISORY_AGENT_HINTS = ["plan", "orchestrator", "prometheus", "sisyphus"] as const;
export function discoverCandidates(config: any, configured: string[] = []) {
  const ids = [...Object.keys(config?.agent ?? {}), ...configured];
  return [...new Set(ids)].map(id => ({ id, advisory: ADVISORY_AGENT_HINTS.includes(id as any) || configured.includes(id) }));
}
export function manualGuidance(base: string, candidates: Array<{ id: string }>) {
  const ids = candidates.map(x => x.id);
  return { mode: "manual", artifactBase: base, candidates: ids, invocation: ids.length ? `Review ${base}. Registered or configured candidate IDs: ${ids.join(", ")}. A human must select and invoke a semantically appropriate agent.` : `Review ${base}, choose a trusted engineering agent, and provide only this validated artifact base.` };
}
export async function registeredAgentIDs(client: StandardClient): Promise<string[]> {
  if (typeof client.app?.agents !== "function") return [];
  const response = await client.app.agents(); if (response?.error) throw new Error("Agent registry query failed");
  const rows = response?.data ?? response; if (!Array.isArray(rows)) throw new Error("Agent registry returned no data");
  return rows.map((row: any) => row?.name ?? row?.id).filter((id: unknown): id is string => typeof id === "string");
}
export async function invokeChild(client: StandardClient, parentID: string, target: string, artifactBase: string) {
  if (typeof client.session?.create !== "function" || typeof client.session?.prompt !== "function") throw new Error("Standard client child-session capability is unavailable");
  const created = await client.session.create({ body: { parentID, title: `Senior PM handoff: ${artifactBase}` } });
  if (created?.error) throw new Error("Child session creation failed");
  const sessionID = created?.data?.id ?? created?.id; if (!sessionID) throw new Error("Child session creation returned no session ID");
  try { const prompted = await client.session.prompt({ path: { id: sessionID }, body: { agent: target, parts: [{ type: "text", text: `Use the freshly validated Senior PM artifact set at: ${artifactBase}` }] } }); if (prompted?.error || prompted?.data === undefined) throw new Error("Child session prompt failed"); }
  catch (error) { try { if (typeof client.session.abort === "function") await client.session.abort({ path: { id: sessionID } }); if (typeof client.session.delete === "function") await client.session.delete({ path: { id: sessionID } }); } catch { /* best effort cleanup */ } throw error; }
  return sessionID as string;
}
