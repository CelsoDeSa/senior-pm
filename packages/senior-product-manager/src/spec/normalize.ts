import { createHash } from "node:crypto";

export function normalizeText(value: string): string {
  return value.replace(/\r\n?/g, "\n").normalize("NFC");
}

function normalized(value: unknown): unknown {
  if (typeof value === "string") return normalizeText(value);
  if (Array.isArray(value)) return value.map(normalized);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value as object).sort().map(k => [k, normalized((value as Record<string, unknown>)[k])]));
  return value;
}

export function deterministicJson(value: unknown): string {
  return `${JSON.stringify(normalized(value), null, 2)}\n`;
}

export function sha256(bytes: string | Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
