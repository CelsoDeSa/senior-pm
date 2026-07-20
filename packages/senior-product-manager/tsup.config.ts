import { defineConfig } from "tsup";

export default defineConfig({
  entry: { plugin: "src/plugin.ts", cli: "src/cli.ts" },
  format: ["esm"],
  platform: "node",
  target: "node20",
  outDir: "dist",
  splitting: false,
  sourcemap: false,
  metafile: true,
  noExternal: [/.*/],
  loader: { ".md": "text" },
});
