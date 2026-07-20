export const PACKAGE_ID = "senior-pm";
export const PLUGIN_ID = "senior-pm.plugin";
export const LEGACY_PLUGIN_ID = "elon-musk-agents.senior-product-manager";
export const OWNERSHIP_MARKER = `${JSON.stringify({ owner: PLUGIN_ID, schemaVersion: "1.0.0" })}\n`;
export const LEGACY_OWNERSHIP_MARKER = `${JSON.stringify({ owner: LEGACY_PLUGIN_ID, schemaVersion: "1.0.0" })}\n`;
export const ACCEPTED_OWNERSHIP_MARKERS = new Set([OWNERSHIP_MARKER, LEGACY_OWNERSHIP_MARKER]);
export const AGENT_ID = "senior-pm";
export const OWNED_SPECIFICATION_DIRECTORY = ".opencode/specs/senior-pm";
