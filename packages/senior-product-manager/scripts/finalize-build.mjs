import { chmod, readFile, writeFile } from "node:fs/promises";
import { builtinModules } from "node:module";

const builtins = new Set(builtinModules.map(name => name.replace(/^node:/, "")));
for (const file of ["dist/plugin.js", "dist/cli.js"]) {
  const source = await readFile(file, "utf8");
  const normalized = source.replace(/(from\s+|import\()(["'])([^"']+)\2/g, (match, prefix, quote, specifier) =>
    builtins.has(specifier) ? `${prefix}${quote}node:${specifier}${quote}` : match,
  );
  await writeFile(file, normalized);
}
await chmod("dist/cli.js", 0o755);
