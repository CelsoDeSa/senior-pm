import {
  mkdtemp,
  mkdir,
  readFile,
  rename,
  symlink,
  writeFile,
  access,
  chmod,
  lstat,
  readdir,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  install,
  uninstall,
  diagnoseUninstall,
  resolveConfigRoot,
  generateWrapper,
  packageRootFromModule,
  type InstallerEnvironment,
} from "../../../src/installer/index.js";
import {
  migrateKnownLegacyInstall,
  readLegacyFingerprint,
} from "../../../src/installer/legacy-migration.js";

async function fixture(version = "1.2.3") {
  const root = await mkdtemp(path.join(os.tmpdir(), "senior-pm-source-"));
  await mkdir(path.join(root, "dist"));
  await mkdir(path.join(root, "assets/agents"), { recursive: true });
  await mkdir(path.join(root, "assets/commands"), { recursive: true });
  await mkdir(path.join(root, "schemas"));
  await writeFile(
    path.join(root, "dist/plugin.js"),
    "export default async()=>({});\n",
  );
  await writeFile(path.join(root, "assets/agents/senior-pm.md"), "agent\n");
  await writeFile(path.join(root, "assets/commands/pm-spec.md"), "command\n");
  await writeFile(path.join(root, "schemas/spec.json"), "{}\n");
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({
      name: "fixture",
      version,
      private: true,
      dependencies: { secret: "no" },
    }),
  );
  return root;
}
const present = (p: string) =>
  access(p).then(
    () => true,
    () => false,
  );
const digest = (x: Uint8Array) => createHash("sha256").update(x).digest("hex");
async function syntheticLegacy(project: string) {
  const config = path.join(project, ".opencode"),
    wrapper = path.join(config, "plugins/senior-product-manager.js"),
    version = path.join(config, "senior-pm-runtime/0.1.0");
  await mkdir(path.dirname(wrapper), { recursive: true });
  await mkdir(path.join(version, "dist"), { recursive: true });
  await mkdir(path.join(version, "schemas"), { recursive: true });
  await writeFile(wrapper, "// visibly synthetic legacy wrapper\n");
  await writeFile(
    path.join(version, "dist/plugin.js"),
    "export default async()=>({legacy:true});\n",
  );
  await writeFile(
    path.join(version, "schemas/spec.json"),
    '{"$id":"https://github.com/CelsoDeSa/elon-musk-agents/schemas/senior-pm-spec.schema.json"}\n',
  );
  await writeFile(
    path.join(version, "package.json"),
    '{"name":"synthetic-legacy","version":"0.1.0","type":"module"}\n',
  );
  await writeFile(
    path.join(version, "ownership.json"),
    '{"pluginId":"elon-musk-agents.senior-product-manager","synthetic":true}\n',
  );
  const entries: any[] = [];
  const walk = async (d: string) => {
    for (const e of await readdir(d, { withFileTypes: true })) {
      const p = path.join(d, e.name),
        s = await lstat(p),
        rel = path.relative(config, p).split(path.sep).join("/");
      if (e.isDirectory()) {
        entries.push({ path: rel, type: "directory", mode: s.mode & 0o777 });
        await walk(p);
      } else
        entries.push({
          path: rel,
          type: "file",
          mode: s.mode & 0o777,
          sha256: digest(await readFile(p)),
        });
    }
  };
  await walk(version);
  entries.sort((a, b) => a.path.localeCompare(b.path));
  const ws = await lstat(wrapper),
    fingerprint = {
      schemaVersion: 1,
      legacyVersion: "0.1.0",
      legacyPluginId: "elon-musk-agents.senior-product-manager",
      wrapper: {
        path: "plugins/senior-product-manager.js",
        type: "file",
        mode: ws.mode & 0o777,
        sha256: digest(await readFile(wrapper)),
      },
      runtimeRoot: "senior-pm-runtime",
      runtimeVersions: ["0.1.0"],
      entries,
      requirements: { zeroSymlinks: true, zeroExtraRuntimeEntries: true },
    },
    file = path.join(project, "synthetic-legacy-fingerprint.json");
  await writeFile(file, JSON.stringify(fingerprint));
  return { config, wrapper, version, fingerprint: file };
}
async function migrateSyntheticLegacyForTesting(
  project: string,
  packageRoot: string,
  fingerprintPath: string,
  hook?: InstallerEnvironment["hook"],
) {
  const fingerprint = await readLegacyFingerprint(fingerprintPath);
  return migrateKnownLegacyInstall(
    path.join(project, ".opencode"),
    fingerprint,
    () =>
      install("project", project, {
        platform: "linux",
        packageRoot,
        ...(hook ? { hook } : {}),
      }),
    async () => {
      const diagnosis = await diagnoseUninstall("project", project, {
        platform: "linux",
        packageRoot,
      });
      if (diagnosis.blockers.length)
        throw new Error(`Synthetic neutral verification failed: ${diagnosis.blockers.join("; ")}`);
    },
    () => uninstall("project", project, { platform: "linux", packageRoot }),
    hook,
  );
}
async function ownedTreeHash(config: string) {
  const rows: string[] = [];
  const walk = async (d: string) => {
    for (const e of (await readdir(d, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const p = path.join(d, e.name),
        s = await lstat(p),
        rel = path.relative(config, p).split(path.sep).join("/");
      rows.push(
        `${e.isDirectory() ? "d" : e.isSymbolicLink() ? "l" : "f"} ${s.mode & 0o777} ${rel}${e.isFile() ? ` ${digest(await readFile(p))}` : ""}`,
      );
      if (e.isDirectory()) await walk(p);
    }
  };
  await walk(config);
  return digest(Buffer.from(rows.join("\n")));
}

describe("installer V-04/V-10", () => {
  it("resolves project and platform-aware user roots", () => {
    expect(
      resolveConfigRoot("project", "/tmp/project", { platform: "linux" }),
    ).toBe("/tmp/project/.opencode");
    expect(
      resolveConfigRoot("user", undefined, {
        platform: "linux",
        home: "/synthetic-home/test",
        env: {},
      }),
    ).toBe("/synthetic-home/test/.config/opencode");
    expect(
      resolveConfigRoot("user", undefined, {
        platform: "linux",
        home: "/x",
        env: { OPENCODE_CONFIG_DIR: "/custom" },
      }),
    ).toBe("/custom");
    expect(
      resolveConfigRoot("user", undefined, {
        platform: "win32",
        home: "C:\\Users\\test",
        env: { APPDATA: "C:\\Data" },
      }),
    ).toContain("opencode");
  });
  it("installs relative wrapper, allowlisted hashed payload, and is source-hash idempotent", async () => {
    const project = await mkdtemp(path.join(os.tmpdir(), "pm-project-")),
      source = await fixture();
    const first = await install("project", project, {
      packageRoot: source,
      platform: "linux",
    });
    expect(first.idempotent).toBe(false);
    const config = path.join(project, ".opencode"),
      wrapper = await readFile(
        path.join(config, "plugins/senior-product-manager.js"),
        "utf8",
      );
    expect(wrapper).not.toContain(source);
    expect(wrapper).toContain("../senior-pm-runtime/1.2.3");
    expect(wrapper).not.toContain("+const");
    const manifest = JSON.parse(
      await readFile(
        path.join(config, "senior-pm-runtime/1.2.3/ownership.json"),
        "utf8",
      ),
    );
    expect(manifest.files.map((x: any) => x.path)).toEqual([
      "assets/agents/senior-pm.md",
      "assets/commands/pm-spec.md",
      "dist/plugin.js",
      "package.json",
      "schemas/spec.json",
    ]);
    await expect(
      install("project", project, { packageRoot: source, platform: "linux" }),
    ).rejects.toThrow(/already exists|uninstall/i);
  });
  it("refuses a different-version upgrade with uninstall guidance", async () => {
    const project = await mkdtemp(path.join(os.tmpdir(), "pm-upgrade-")),
      a = await fixture("1.0.0"),
      b = await fixture("2.0.0");
    await install("project", project, { packageRoot: a, platform: "linux" });
    await expect(
      install("project", project, { packageRoot: b, platform: "linux" }),
    ).rejects.toThrow(/uninstall|different/i);
    expect(
      await readFile(
        path.join(project, ".opencode/senior-pm-runtime/1.0.0/dist/plugin.js"),
        "utf8",
      ),
    ).toContain("export default");
  });
  it("refuses same-version source mismatch and force-like/unowned collisions", async () => {
    const project = await mkdtemp(path.join(os.tmpdir(), "pm-collision-")),
      a = await fixture();
    await install("project", project, { packageRoot: a, platform: "linux" });
    await writeFile(path.join(a, "dist/plugin.js"), "different");
    await expect(
      install("project", project, { packageRoot: a, platform: "linux" }),
    ).rejects.toThrow(/runtime|uninstall/i);
    const p2 = await mkdtemp(path.join(os.tmpdir(), "pm-collision-"));
    await mkdir(path.join(p2, ".opencode/plugins"), { recursive: true });
    await writeFile(
      path.join(p2, ".opencode/plugins/senior-product-manager.js"),
      "host",
    );
    await expect(
      install("project", p2, { packageRoot: a, platform: "linux" }),
    ).rejects.toThrow(/refused/i);
  });
  it("rolls back interrupted staging and fails closed off Linux", async () => {
    const project = await mkdtemp(path.join(os.tmpdir(), "pm-rollback-")),
      source = await fixture();
    await expect(
      install("project", project, {
        packageRoot: source,
        platform: "linux",
        failAfterFiles: 2,
      }),
    ).rejects.toThrow("interrupted");
    expect(
      await present(
        path.join(
          project,
          ".opencode/senior-pm-runtime/versions/1.2.3/dist/plugin.js",
        ),
      ),
    ).toBe(false);
    const other = await mkdtemp(path.join(os.tmpdir(), "pm-other-"));
    await expect(
      install("project", other, { packageRoot: source, platform: "darwin" }),
    ).rejects.toThrow("unsupported");
    expect(await present(path.join(other, ".opencode"))).toBe(false);
  });
  it("refuses modified/missing/unowned uninstall and preserves unrelated files", async () => {
    const project = await mkdtemp(path.join(os.tmpdir(), "pm-uninstall-")),
      source = await fixture();
    await install("project", project, {
      packageRoot: source,
      platform: "linux",
    });
    const config = path.join(project, ".opencode");
    await writeFile(path.join(config, "keep.txt"), "keep");
    await writeFile(
      path.join(config, "senior-pm-runtime/1.2.3/dist/plugin.js"),
      "modified",
    );
    expect(
      (
        await diagnoseUninstall("project", project, {
          platform: "linux",
          packageRoot: source,
        })
      ).blockers.length,
    ).toBeGreaterThan(0);
    await expect(
      uninstall("project", project, { platform: "linux", packageRoot: source }),
    ).rejects.toThrow();
    expect(await readFile(path.join(config, "keep.txt"), "utf8")).toBe("keep");
  });
  it("cleanly uninstalls while preserving unrelated config", async () => {
    const project = await mkdtemp(path.join(os.tmpdir(), "pm-clean-")),
      source = await fixture();
    await install("project", project, {
      packageRoot: source,
      platform: "linux",
    });
    const keep = path.join(project, ".opencode/keep.txt");
    await writeFile(keep, "keep");
    await uninstall("project", project, {
      platform: "linux",
      packageRoot: source,
    });
    expect(
      await present(
        path.join(project, ".opencode/plugins/senior-product-manager.js"),
      ),
    ).toBe(false);
    expect(await readFile(keep, "utf8")).toBe("keep");
  });
  it("rejects symlink payload sources and traversal-like versions", async () => {
    const project = await mkdtemp(path.join(os.tmpdir(), "pm-attack-")),
      source = await fixture();
    await symlink("/etc/passwd", path.join(source, "assets/escape"));
    await expect(
      install("project", project, { packageRoot: source, platform: "linux" }),
    ).rejects.toThrow("symlink");
    await expect(
      install("project", project, {
        packageRoot: source,
        platform: "linux",
        version: "../x",
      }),
    ).rejects.toThrow("Invalid package version");
  });
  it("generates syntax-clean fixed-version wrappers and resolves source/built package roots", () => {
    const w = generateWrapper("1.2.3", "a".repeat(64));
    expect(w).not.toContain("+const");
    expect(w).toContain("senior-pm-runtime/1.2.3");
    expect(
      packageRootFromModule("file:///tmp/pkg/src/installer/index.js"),
    ).toBe("/tmp/pkg");
    expect(
      packageRootFromModule("file:///tmp/pkg/dist/installer/index.js"),
    ).toBe("/tmp/pkg");
  });
  it("imports the actual generated wrapper from a relocated clean tree", async () => {
    const project = await mkdtemp(path.join(os.tmpdir(), "pm-wrapper-")),
      source = await fixture();
    await install("project", project, {
      platform: "linux",
      packageRoot: source,
    });
    const wrapper = path.join(
        project,
        ".opencode/plugins/senior-product-manager.js",
      ),
      module = await import(
        `${new URL(`file://${wrapper}`).href}?test=${Date.now()}`
      );
    expect(typeof module.default).toBe("function");
  });
  it("rejects malicious manifest traversal and unexpected newly appearing files", async () => {
    const project = await mkdtemp(path.join(os.tmpdir(), "pm-manifest-")),
      source = await fixture();
    await install("project", project, {
      packageRoot: source,
      platform: "linux",
    });
    const manifest = path.join(
        project,
        ".opencode/senior-pm-runtime/1.2.3/ownership.json",
      ),
      raw = JSON.parse(await readFile(manifest, "utf8"));
    raw.files[0].path = "../escape";
    await writeFile(manifest, JSON.stringify(raw) + "\n");
    await expect(
      uninstall("project", project, { platform: "linux", packageRoot: source }),
    ).rejects.toThrow(/manifest|payload/i);
  });
  it("refuses preseeded canonical-looking trees and attacker wrapper ledgers", async () => {
    const project = await mkdtemp(path.join(os.tmpdir(), "pm-preseed-")),
      source = await fixture();
    await mkdir(path.join(project, ".opencode/senior-pm-runtime/1.2.3"), {
      recursive: true,
    });
    await mkdir(path.join(project, ".opencode/plugins"), { recursive: true });
    await writeFile(
      path.join(project, ".opencode/plugins/senior-product-manager.js"),
      generateWrapper("1.2.3", "a".repeat(64)),
    );
    await expect(
      install("project", project, { platform: "linux", packageRoot: source }),
    ).rejects.toThrow(/refused/i);
  });
  it("refuses a newly appearing file during complete pre-mutation reverify", async () => {
    const project = await mkdtemp(path.join(os.tmpdir(), "pm-new-file-")),
      source = await fixture();
    await install("project", project, {
      platform: "linux",
      packageRoot: source,
    });
    const entry = path.join(
      project,
      ".opencode/senior-pm-runtime/1.2.3/dist/plugin.js",
    );
    await expect(
      uninstall("project", project, {
        platform: "linux",
        packageRoot: source,
        hook: async (point) => {
          if (point === "before-full-reverify")
            await writeFile(
              path.join(project, ".opencode/senior-pm-runtime/1.2.3/attacker"),
              "x",
            );
        },
      }),
    ).rejects.toThrow(/Unexpected/);
    expect(await present(entry)).toBe(true);
  });
  it("keeps mutations on the pinned root when its pathname is replaced", async () => {
    const project = await mkdtemp(path.join(os.tmpdir(), "pm-pin-")),
      source = await fixture(),
      moved = path.join(project, "pinned");
    await install("project", project, {
      platform: "linux",
      packageRoot: source,
      hook: async (point) => {
        if (point === "after-config-pinned") {
          await (
            await import("node:fs/promises")
          ).rename(path.join(project, ".opencode"), moved);
          await mkdir(path.join(project, ".opencode"));
        }
      },
    });
    expect(
      await present(
        path.join(project, ".opencode/plugins/senior-product-manager.js"),
      ),
    ).toBe(false);
    expect(
      await present(path.join(moved, "plugins/senior-product-manager.js")),
    ).toBe(true);
  });
  it("blocks asset tampering before wrapper plugin import", async () => {
    const project = await mkdtemp(path.join(os.tmpdir(), "pm-asset-")),
      source = await fixture();
    await install("project", project, {
      platform: "linux",
      packageRoot: source,
    });
    await writeFile(
      path.join(
        project,
        ".opencode/senior-pm-runtime/1.2.3/assets/agents/senior-pm.md",
      ),
      "tampered",
    );
    const wrapper = path.join(
      project,
      ".opencode/plugins/senior-product-manager.js",
    );
    await expect(
      import(`${new URL(`file://${wrapper}`).href}?tamper=${Date.now()}`),
    ).rejects.toThrow(/integrity/);
  });
  it("supports matching uninstall then clean reinstall", async () => {
    const project = await mkdtemp(path.join(os.tmpdir(), "pm-reinstall-")),
      source = await fixture();
    await install("project", project, {
      platform: "linux",
      packageRoot: source,
    });
    await uninstall("project", project, {
      platform: "linux",
      packageRoot: source,
    });
    expect(
      (
        await install("project", project, {
          platform: "linux",
          packageRoot: source,
        })
      ).idempotent,
    ).toBe(false);
  });
  for (const stage of [
    "after-exclusive-open:senior-pm.md",
    "after-write:senior-pm.md",
    "after-sync:senior-pm.md",
  ]) {
    it(`rolls back exact roots and partial file on ${stage}`, async () => {
      const project = await mkdtemp(path.join(os.tmpdir(), "pm-io-")),
        source = await fixture();
      await expect(
        install("project", project, {
          platform: "linux",
          packageRoot: source,
          hook: (point) => {
            if (point === stage) throw new Error(stage);
          },
        }),
      ).rejects.toThrow(stage);
      expect(await present(path.join(project, ".opencode"))).toBe(false);
    });
  }
  for (const stage of [
    "before-move-wrapper",
    "after-move-wrapper",
    "before-move-payload",
    "after-both-moves",
  ]) {
    it(`restores the fully active install on pre-commit ${stage}`, async () => {
      const project = await mkdtemp(path.join(os.tmpdir(), "pm-move-")),
        source = await fixture();
      await install("project", project, {
        platform: "linux",
        packageRoot: source,
      });
      await expect(
        uninstall("project", project, {
          platform: "linux",
          packageRoot: source,
          hook: (point) => {
            if (point === stage) throw new Error(stage);
          },
        }),
      ).rejects.toThrow(stage);
      expect(
        await present(
          path.join(project, ".opencode/plugins/senior-product-manager.js"),
        ),
      ).toBe(true);
      expect(
        await present(
          path.join(
            project,
            ".opencode/senior-pm-runtime/1.2.3/dist/plugin.js",
          ),
        ),
      ).toBe(true);
    });
  }
  it("leaves only named owned quarantine after committed cleanup failure", async () => {
    const project = await mkdtemp(path.join(os.tmpdir(), "pm-cleanup-")),
      source = await fixture();
    await install("project", project, {
      platform: "linux",
      packageRoot: source,
    });
    const result = await uninstall("project", project, {
      platform: "linux",
      packageRoot: source,
      hook: (point) => {
        if (point === "before-delete:dist/plugin.js")
          throw new Error("cleanup failure");
      },
    });
    expect(result.cleanupRequired).toBe(true);
    expect(result.quarantine).toMatch(/^\.senior-pm-uninstall-quarantine-/);
    expect(
      await present(
        path.join(project, ".opencode/plugins/senior-product-manager.js"),
      ),
    ).toBe(false);
    expect(
      await present(path.join(project, ".opencode/senior-pm-runtime/1.2.3")),
    ).toBe(false);
    expect(
      await present(path.join(project, ".opencode", result.quarantine!)),
    ).toBe(true);
  });
  it("rejects a symlinked consumed asset before plugin import", async () => {
    const project = await mkdtemp(path.join(os.tmpdir(), "pm-link-")),
      source = await fixture();
    await install("project", project, {
      platform: "linux",
      packageRoot: source,
    });
    const asset = path.join(
      project,
      ".opencode/senior-pm-runtime/1.2.3/assets/commands/pm-spec.md",
    );
    await (await import("node:fs/promises")).rm(asset);
    await symlink("/etc/passwd", asset);
    const wrapper = path.join(
      project,
      ".opencode/plugins/senior-product-manager.js",
    );
    await expect(
      import(`${new URL(`file://${wrapper}`).href}?link=${Date.now()}`),
    ).rejects.toThrow(/regular file/);
  });
  for (const replacement of ["wrapper", "payload"]) {
    it(`does not commit when an active ${replacement} is recreated after both moves`, async () => {
      const project = await mkdtemp(path.join(os.tmpdir(), "pm-replace-")),
        source = await fixture(),
        config = path.join(project, ".opencode");
      await install("project", project, {
        platform: "linux",
        packageRoot: source,
      });
      const result = await uninstall("project", project, {
        platform: "linux",
        packageRoot: source,
        hook: async (point) => {
          if (point === "after-quarantine-verify-before-commit") {
            if (replacement === "wrapper")
              await writeFile(
                path.join(config, "plugins/senior-product-manager.js"),
                "unrelated replacement",
              );
            else {
              await mkdir(path.join(config, "senior-pm-runtime/1.2.3"));
              await writeFile(
                path.join(config, "senior-pm-runtime/1.2.3/unrelated"),
                "keep",
              );
            }
          }
        },
      });
      expect(result.cleanupRequired).toBe(true);
      expect(result.recoveryRequired).toBe(true);
      expect(result.removedVersions).toEqual([]);
      expect(await present(path.join(config, result.quarantine!))).toBe(true);
      expect(
        await present(
          replacement === "wrapper"
            ? path.join(config, "plugins/senior-product-manager.js")
            : path.join(config, "senior-pm-runtime/1.2.3/unrelated"),
        ),
      ).toBe(true);
    });
  }
  for (const target of ["wrapper", "payload"]) {
    it(`reports exact ${target} restoration failure without false restoration`, async () => {
      const project = await mkdtemp(path.join(os.tmpdir(), "pm-restore-")),
        source = await fixture(),
        config = path.join(project, ".opencode");
      await install("project", project, {
        platform: "linux",
        packageRoot: source,
      });
      const trigger =
          target === "wrapper" ? "after-move-wrapper" : "after-both-moves",
        restore =
          target === "wrapper"
            ? "before-restore-wrapper"
            : "before-restore-payload";
      const result = await uninstall("project", project, {
        platform: "linux",
        packageRoot: source,
        hook: (point) => {
          if (point === trigger) throw new Error("trigger");
          if (point === restore) throw new Error(`${target} restore denied`);
        },
      });
      expect(result.cleanupRequired).toBe(true);
      expect(result.recoveryRequired).toBe(true);
      expect(result.restorationFailures?.join(" ")).toContain(
        `${target} restore denied`,
      );
      expect(await present(path.join(config, result.quarantine!))).toBe(true);
    });
  }
  it("detects a post-cleanup active replacement and preserves quarantine", async () => {
    const project = await mkdtemp(path.join(os.tmpdir(), "pm-post-clean-")),
      source = await fixture(),
      config = path.join(project, ".opencode");
    await install("project", project, {
      platform: "linux",
      packageRoot: source,
    });
    const result = await uninstall("project", project, {
      platform: "linux",
      packageRoot: source,
      hook: async (point) => {
        if (point === "before-return-active-check")
          await writeFile(
            path.join(config, "plugins/senior-product-manager.js"),
            "replacement",
          );
      },
    });
    expect(result.cleanupRequired).toBe(true);
    expect(result.recoveryRequired).toBe(true);
    expect(result.removedVersions).toEqual([]);
    expect(
      await readFile(
        path.join(config, "plugins/senior-product-manager.js"),
        "utf8",
      ),
    ).toBe("replacement");
    expect(await present(path.join(config, result.quarantine!))).toBe(true);
  });
  it("rechecks active paths when replacement creation and quarantine deletion failure race", async () => {
    const project = await mkdtemp(path.join(os.tmpdir(), "pm-delete-race-")),
      source = await fixture(),
      config = path.join(project, ".opencode");
    await install("project", project, {
      platform: "linux",
      packageRoot: source,
    });
    const result = await uninstall("project", project, {
      platform: "linux",
      packageRoot: source,
      hook: async (point) => {
        if (point === "before-delete:dist/plugin.js") {
          await writeFile(
            path.join(config, "plugins/senior-product-manager.js"),
            "replacement",
          );
          throw new Error("delete interrupted");
        }
      },
    });
    expect(result.cleanupRequired).toBe(true);
    expect(result.recoveryRequired).toBe(true);
    expect(result.removedVersions).toEqual([]);
    expect(result.diagnostic).toMatch(/wrapper=present/);
    expect(
      await readFile(
        path.join(config, "plugins/senior-product-manager.js"),
        "utf8",
      ),
    ).toBe("replacement");
    expect(await present(path.join(config, result.quarantine!))).toBe(true);
  });
  for (const parent of ["plugins", "runtime"]) {
    it(`detects detached ${parent} parent after quarantine`, async () => {
      const project = await mkdtemp(path.join(os.tmpdir(), "pm-parent-")),
        source = await fixture(),
        config = path.join(project, ".opencode"),
        name = parent === "plugins" ? "plugins" : "senior-pm-runtime",
        current = path.join(config, name),
        detached = path.join(config, `${name}-detached`);
      await install("project", project, {
        platform: "linux",
        packageRoot: source,
      });
      const result = await uninstall("project", project, {
        platform: "linux",
        packageRoot: source,
        hook: async (point) => {
          if (point === "after-quarantine-verify-before-commit") {
            await rename(current, detached);
            await mkdir(current);
            await writeFile(path.join(current, "replacement"), "keep");
          }
        },
      });
      expect(result.cleanupRequired).toBe(true);
      expect(result.recoveryRequired).toBe(true);
      expect(result.removedVersions).toEqual([]);
      expect(result.diagnostic).toMatch(/parent_identity_changed/);
      expect(await readFile(path.join(current, "replacement"), "utf8")).toBe(
        "keep",
      );
      expect(await present(path.join(config, result.quarantine!))).toBe(true);
    });
  }
  for (const parent of ["wrapper", "payload"]) {
    it(`refuses ${parent} restoration into a replaced parent`, async () => {
      const project = await mkdtemp(
          path.join(os.tmpdir(), "pm-restore-parent-"),
        ),
        source = await fixture(),
        config = path.join(project, ".opencode"),
        name = parent === "wrapper" ? "plugins" : "senior-pm-runtime",
        current = path.join(config, name),
        detached = path.join(config, `${name}-detached`),
        trigger =
          parent === "wrapper" ? "after-move-wrapper" : "after-both-moves",
        restore =
          parent === "wrapper"
            ? "before-restore-wrapper"
            : "before-restore-payload";
      await install("project", project, {
        platform: "linux",
        packageRoot: source,
      });
      const result = await uninstall("project", project, {
        platform: "linux",
        packageRoot: source,
        hook: async (point) => {
          if (point === trigger) throw new Error("trigger restore");
          if (point === restore) {
            await rename(current, detached);
            await mkdir(current);
            await writeFile(path.join(current, "replacement"), "keep");
          }
        },
      });
      expect(result.cleanupRequired).toBe(true);
      expect(result.recoveryRequired).toBe(true);
      expect(result.removedVersions).toEqual([]);
      expect(result.restorationFailures?.join(" ")).toMatch(/identity changed/);
      expect(await readFile(path.join(current, "replacement"), "utf8")).toBe(
        "keep",
      );
      expect(await present(path.join(config, result.quarantine!))).toBe(true);
    });
  }
  it("migrates only an exact synthetic legacy 0.1.0 fingerprint and preserves unrelated files", async () => {
    const project = await mkdtemp(path.join(os.tmpdir(), "pm-legacy-migrate-")),
      legacy = await syntheticLegacy(project),
      source = await fixture("0.1.0");
    await writeFile(path.join(legacy.config, "keep.txt"), "unrelated");
    const result = await migrateSyntheticLegacyForTesting(
      project,
      source,
      legacy.fingerprint,
    );
    expect("migratedFrom" in result && result.migratedFrom).toBe("0.1.0");
    expect(await readFile(path.join(legacy.config, "keep.txt"), "utf8")).toBe(
      "unrelated",
    );
    expect(
      await readFile(
        path.join(legacy.config, "senior-pm-runtime/0.1.0/package.json"),
        "utf8",
      ),
    ).toContain('"name": "fixture"');
    expect(
      await readFile(
        path.join(legacy.config, "plugins/senior-product-manager.js"),
        "utf8",
      ),
    ).toContain("senior-pm.plugin");
    await expect(
      install("project", project, {
        platform: "linux",
        packageRoot: source,
      }),
    ).rejects.toThrow(/fingerprint differs|migration refused|not eligible/i);
  });
  it("does not expose caller-controlled fingerprint selection through install", async () => {
    const project = await mkdtemp(path.join(os.tmpdir(), "pm-legacy-authority-"));
    const legacy = await syntheticLegacy(project);
    const source = await fixture("0.1.0");
    const before = await ownedTreeHash(legacy.config);
    await expect(
      install("project", project, {
        platform: "linux",
        packageRoot: source,
        legacyFingerprintPath: legacy.fingerprint,
      } as InstallerEnvironment & { legacyFingerprintPath: string }),
    ).rejects.toThrow(/not eligible|fingerprint/i);
    expect(await ownedTreeHash(legacy.config)).toBe(before);
  });
  it("restores exact legacy bytes and modes after every pre-commit migration fault", async () => {
    for (const stage of [
      "legacy-migration:after-quarantine",
      "legacy-migration:after-neutral-install-before-commit",
    ]) {
      const project = await mkdtemp(
          path.join(os.tmpdir(), "pm-legacy-restore-"),
        ),
        legacy = await syntheticLegacy(project),
        source = await fixture("0.1.0"),
        before = await ownedTreeHash(legacy.config);
      await expect(
        migrateSyntheticLegacyForTesting(
          project,
          source,
          legacy.fingerprint,
          (point) => {
            if (point === stage) throw new Error(stage);
          },
        ),
      ).rejects.toThrow(stage);
      expect(await ownedTreeHash(legacy.config)).toBe(before);
    }
  });
  it("refuses every legacy fingerprint difference before quarantine or mutation", async () => {
    for (const mutation of ["payload", "mode", "extra", "version", "symlink"]) {
      const project = await mkdtemp(
          path.join(os.tmpdir(), "pm-legacy-refuse-"),
        ),
        legacy = await syntheticLegacy(project),
        source = await fixture("0.1.0");
      if (mutation === "payload")
        await writeFile(path.join(legacy.version, "dist/plugin.js"), "changed");
      if (mutation === "mode") await chmod(legacy.wrapper, 0o600);
      if (mutation === "extra")
        await writeFile(path.join(legacy.version, "extra"), "x");
      if (mutation === "version")
        await mkdir(path.join(legacy.config, "senior-pm-runtime/0.2.0"));
      if (mutation === "symlink")
        await symlink("dist/plugin.js", path.join(legacy.version, "link"));
      const before = await ownedTreeHash(legacy.config);
      await expect(
        migrateSyntheticLegacyForTesting(
          project,
          source,
          legacy.fingerprint,
        ),
      ).rejects.toThrow(/Legacy migration refused/);
      expect(await ownedTreeHash(legacy.config)).toBe(before);
      expect(
        (await readdir(legacy.config)).some((x) =>
          x.startsWith(".senior-pm-legacy-migration-"),
        ),
      ).toBe(false);
    }
  });
  it("refuses a wrapper replacement after final verification before moving it", async () => {
    const project = await mkdtemp(
        path.join(os.tmpdir(), "pm-legacy-final-race-"),
      ),
      legacy = await syntheticLegacy(project),
      source = await fixture("0.1.0"),
      replacement = path.join(project, "replacement-wrapper");
    await writeFile(replacement, "replacement");
    const result = await migrateSyntheticLegacyForTesting(
      project,
      source,
      legacy.fingerprint,
      async (point) => {
        if (point === "legacy-migration:before-move-wrapper")
          await rename(replacement, legacy.wrapper);
      },
    );
    expect(result).toMatchObject({
      cleanupRequired: true,
      recoveryRequired: true,
    });
    expect(result.diagnostic).toMatch(/wrapper target identity changed/);
    expect(await readFile(legacy.wrapper, "utf8")).toBe("replacement");
    expect(await present(path.join(legacy.config, result.quarantine!))).toBe(
      true,
    );
  });
  it("detects runtime replacement between wrapper and runtime moves and preserves recovery state", async () => {
    const project = await mkdtemp(
        path.join(os.tmpdir(), "pm-legacy-between-moves-"),
      ),
      legacy = await syntheticLegacy(project),
      source = await fixture("0.1.0"),
      detached = path.join(legacy.config, "legacy-runtime-detached");
    const result = await migrateSyntheticLegacyForTesting(
      project,
      source,
      legacy.fingerprint,
      async (point) => {
        if (point === "legacy-migration:after-move-wrapper") {
          await rename(path.join(legacy.config, "senior-pm-runtime"), detached);
          await mkdir(path.join(legacy.config, "senior-pm-runtime/0.1.0"), {
            recursive: true,
          });
          await writeFile(
            path.join(legacy.config, "senior-pm-runtime/0.1.0/unrelated"),
            "keep",
          );
        }
      },
    );
    expect(result.cleanupRequired).toBe(true);
    expect(result.recoveryRequired).toBe(true);
    expect(
      await readFile(
        path.join(legacy.config, "senior-pm-runtime/0.1.0/unrelated"),
        "utf8",
      ),
    ).toBe("keep");
    expect(await present(detached)).toBe(true);
    expect(await present(path.join(legacy.config, result.quarantine!))).toBe(
      true,
    );
  });
  it("restores through pinned descriptors when the config pathname is replaced", async () => {
    const project = await mkdtemp(
        path.join(os.tmpdir(), "pm-legacy-config-parent-"),
      ),
      legacy = await syntheticLegacy(project),
      source = await fixture("0.1.0"),
      detached = path.join(project, "detached-config"),
      before = await ownedTreeHash(legacy.config);
    await expect(
      migrateSyntheticLegacyForTesting(
        project,
        source,
        legacy.fingerprint,
        async (point) => {
          if (point === "legacy-migration:after-quarantine") {
            await rename(legacy.config, detached);
            await mkdir(legacy.config);
            await writeFile(path.join(legacy.config, "unrelated"), "keep");
          }
        },
      ),
    ).rejects.toThrow(/config pathname identity changed/);
    expect(await ownedTreeHash(detached)).toBe(before);
    expect(await readFile(path.join(legacy.config, "unrelated"), "utf8")).toBe(
      "keep",
    );
  });
  it("preserves quarantine and reports recovery when content is injected before commit", async () => {
    const project = await mkdtemp(
        path.join(os.tmpdir(), "pm-legacy-injection-"),
      ),
      legacy = await syntheticLegacy(project),
      source = await fixture("0.1.0");
    const result = await migrateSyntheticLegacyForTesting(
      project,
      source,
      legacy.fingerprint,
      async (point) => {
        if (point === "legacy-migration:after-neutral-install-before-commit") {
          const quarantine = (await readdir(legacy.config)).find((name) =>
            name.startsWith(".senior-pm-legacy-migration-"),
          )!;
          await writeFile(
            path.join(legacy.config, quarantine, "injected"),
            "keep",
          );
        }
      },
    );
    expect(result.cleanupRequired).toBe(true);
    expect(result.recoveryRequired).toBe(true);
    expect(result.diagnostic).toMatch(/restoration was incomplete/);
    expect(
      await readFile(
        path.join(legacy.config, result.quarantine!, "injected"),
        "utf8",
      ),
    ).toBe("keep");
  });
  it("preserves a replaced quarantine pathname after neutral commit", async () => {
    const project = await mkdtemp(
        path.join(os.tmpdir(), "pm-legacy-quarantine-replace-"),
      ),
      legacy = await syntheticLegacy(project),
      source = await fixture("0.1.0");
    let detached = "";
    const result = await migrateSyntheticLegacyForTesting(
      project,
      source,
      legacy.fingerprint,
      async (point) => {
        if (point === "legacy-migration:before-quarantine-cleanup") {
          const quarantine = (await readdir(legacy.config)).find((name) =>
            name.startsWith(".senior-pm-legacy-migration-"),
          )!;
          detached = path.join(legacy.config, `${quarantine}-detached`);
          await rename(path.join(legacy.config, quarantine), detached);
          await mkdir(path.join(legacy.config, quarantine));
          await writeFile(
            path.join(legacy.config, quarantine, "replacement"),
            "keep",
          );
        }
      },
    );
    expect(result.cleanupRequired).toBe(true);
    expect(result.recoveryRequired).toBe(true);
    expect(await present(detached)).toBe(true);
    expect(
      await readFile(
        path.join(legacy.config, result.quarantine!, "replacement"),
        "utf8",
      ),
    ).toBe("keep");
    expect(
      await readFile(
        path.join(legacy.config, "plugins/senior-product-manager.js"),
        "utf8",
      ),
    ).toContain("senior-pm.plugin");
  });
  it("returns structured cleanup state without deleting injected quarantine entries", async () => {
    const project = await mkdtemp(
        path.join(os.tmpdir(), "pm-legacy-cleanup-state-"),
      ),
      legacy = await syntheticLegacy(project),
      source = await fixture("0.1.0");
    const result = await migrateSyntheticLegacyForTesting(
      project,
      source,
      legacy.fingerprint,
      async (point) => {
        if (point === "legacy-migration:before-quarantine-cleanup") {
          const quarantine = (await readdir(legacy.config)).find((name) =>
            name.startsWith(".senior-pm-legacy-migration-"),
          )!;
          await writeFile(
            path.join(legacy.config, quarantine, "unexpected"),
            "keep",
          );
        }
      },
    );
    expect(result).toMatchObject({
      migratedFrom: "0.1.0",
      cleanupRequired: true,
      recoveryRequired: true,
    });
    expect(
      await readFile(
        path.join(legacy.config, result.quarantine!, "unexpected"),
        "utf8",
      ),
    ).toBe("keep");
    expect(
      await readFile(path.join(legacy.config, "keep.txt"), "utf8").catch(
        () => "absent",
      ),
    ).toBe("absent");
  });
  it("revalidates the neutral installation before committing legacy cleanup", async () => {
    const project = await mkdtemp(
        path.join(os.tmpdir(), "pm-legacy-neutral-race-"),
      ),
      legacy = await syntheticLegacy(project),
      source = await fixture("0.1.0");
    const result = await migrateSyntheticLegacyForTesting(
      project,
      source,
      legacy.fingerprint,
      async (point) => {
        if (point === "legacy-migration:after-neutral-install-before-commit")
          await writeFile(
            path.join(legacy.config, "plugins/senior-product-manager.js"),
            "replacement",
          );
      },
    );
    expect(result).toMatchObject({
      cleanupRequired: true,
      recoveryRequired: true,
    });
    expect(result.diagnostic).toMatch(
      /neutral cleanup|restoration was incomplete/i,
    );
    expect(
      await readFile(
        path.join(legacy.config, "plugins/senior-product-manager.js"),
        "utf8",
      ),
    ).toBe("replacement");
    expect(await present(path.join(legacy.config, result.quarantine!))).toBe(
      true,
    );
  });
});
