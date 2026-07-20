import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const ignored = new Set([".git", "node_modules", "dist", ".candidate-evidence"]);
const authoredPrefixes = ["scripts/", "examples/synthetic-public/", "packages/senior-product-manager/LICENSES/", "packages/senior-product-manager/sbom/", "packages/senior-product-manager/test/fixtures/compatibility/", "packages/senior-product-manager/test/fixtures/security/"];
const authoredFiles = new Set(["docs/export-provenance.md", "packages/senior-product-manager/THIRD_PARTY_NOTICES.md", "packages/senior-product-manager/src/installer/legacy-migration.ts", "packages/senior-product-manager/assets/compatibility/known-legacy-0.1.0-fingerprint.json"]);
const entries = [];

async function walk(directory) {
  for (const name of (await readdir(directory)).sort()) {
    const absolute = path.join(directory, name);
    const relative = path.relative(root, absolute).split(path.sep).join("/");
    if (relative === "docs/export-inventory.json" || ignored.has(name) || relative.split("/").some(part => ignored.has(part))) continue;
    const info = await stat(absolute);
    if (info.isDirectory()) await walk(absolute);
    else if (info.isFile()) {
      const bytes = await readFile(absolute);
      const authored = authoredFiles.has(relative) || authoredPrefixes.some(prefix => relative.startsWith(prefix));
      entries.push({ path: relative, provenance: authored ? "candidate-authored" : "reviewed-sanitized-export", sha256: createHash("sha256").update(bytes).digest("hex") });
    }
  }
}

try {
  const files = execFileSync("git", ["ls-files", "-z"], { cwd: root }).toString().split("\0").filter(Boolean).sort();
  for (const relative of files) {
    if (relative === "docs/export-inventory.json") continue;
    const bytes = await readFile(path.join(root, relative));
    const authored = authoredFiles.has(relative) || authoredPrefixes.some(prefix => relative.startsWith(prefix));
    entries.push({ path: relative, provenance: authored ? "candidate-authored" : "reviewed-sanitized-export", sha256: createHash("sha256").update(bytes).digest("hex") });
  }
} catch {
  await walk(root);
}
entries.push({ path: "docs/export-inventory.json", provenance: "candidate-authored-inventory" });
entries.sort((a, b) => a.path.localeCompare(b.path));
await mkdir(path.join(root, "docs"), { recursive: true });
await writeFile(path.join(root, "docs/export-inventory.json"), JSON.stringify({ schemaVersion: 1, generatedAt: "2026-07-19", entries }, null, 2) + "\n");
console.log(`export-inventory entries=${entries.length}`);
