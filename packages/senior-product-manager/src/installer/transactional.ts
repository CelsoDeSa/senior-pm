import { constants } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import {
  open,
  readFile,
  realpath,
  readdir,
  rename,
  rmdir,
  unlink,
  type FileHandle,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  generateWrapper,
  packageRootFromModule,
  PLUGIN_ID,
  resolveConfigRoot,
  type InstallScope,
  type InstallerEnvironment,
  type OwnedFile,
  type OwnershipManifest,
} from "./index.js";

type Payload = { rel: string; data: Buffer; sha256: string };
type Identity = { dev: bigint; ino: bigint };
type Tree = {
  config: FileHandle;
  plugins: FileHandle;
  runtime: FileHandle;
  version: FileHandle;
  pluginsIdentity: Identity;
  runtimeIdentity: Identity;
};
const RUNTIME = "senior-pm-runtime",
  WRAPPER = "senior-product-manager.js",
  MANIFEST = "ownership.json",
  Q_PREFIX = ".senior-pm-uninstall-quarantine-";
const sha = (x: Uint8Array | string) =>
  createHash("sha256").update(x).digest("hex");
const component = (x: string) => {
  if (
    !x ||
    x === "." ||
    x === ".." ||
    x.includes("/") ||
    x.includes("\\") ||
    x.includes("\0")
  )
    throw new Error(`Unsafe component: ${x}`);
  return x;
};
const fd = (h: FileHandle, n?: string) =>
  `/proc/self/fd/${h.fd}${n === undefined ? "" : `/${component(n)}`}`;
async function pin(p: string) {
  const h = await open(
    p,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
  );
  const s = await h.stat();
  if (!s.isDirectory()) {
    await h.close();
    throw new Error("Pinned path is not a directory");
  }
  return h;
}
async function child(h: FileHandle, n: string) {
  return pin(fd(h, n));
}
async function entries(h: FileHandle) {
  return readdir(fd(h), { withFileTypes: true });
}
async function regular(h: FileHandle, n: string) {
  const f = await open(fd(h, n), constants.O_RDONLY | constants.O_NOFOLLOW);
  const s = await f.stat({ bigint: true });
  if (!s.isFile()) {
    await f.close();
    throw new Error(`Not a regular file: ${n}`);
  }
  return { f, s };
}
async function bytes(h: FileHandle, n: string) {
  const { f, s } = await regular(h, n);
  try {
    return { data: await f.readFile(), s };
  } finally {
    await f.close();
  }
}
async function closeAll(xs: (FileHandle | undefined)[]) {
  await Promise.allSettled(xs.filter(Boolean).map((x) => x!.close()));
}
async function openAbsolute(target: string) {
  if (!path.isAbsolute(target)) throw new Error("Config root must be absolute");
  let h = await pin(path.parse(target).root);
  try {
    for (const p of target
      .slice(path.parse(target).root.length)
      .split(path.sep)
      .filter(Boolean)) {
      const n = await child(h, p);
      await h.close();
      h = n;
    }
    return h;
  } catch (e) {
    await h.close();
    throw e;
  }
}
async function duplicateDirectory(directory: FileHandle) {
  const duplicate = await open(
    fd(directory),
    constants.O_RDONLY | constants.O_DIRECTORY,
  );
  try {
    const [expected, actual] = await Promise.all([
      directory.stat({ bigint: true }),
      duplicate.stat({ bigint: true }),
    ]);
    if (expected.dev !== actual.dev || expected.ino !== actual.ino)
      throw new Error("Pinned config identity changed");
    return duplicate;
  } catch (error) {
    await duplicate.close();
    throw error;
  }
}
async function openTree(
  configPath: string,
  version: string,
  pinnedConfig?: FileHandle,
): Promise<Tree> {
  let config: FileHandle | undefined,
    plugins: FileHandle | undefined,
    runtime: FileHandle | undefined,
    v: FileHandle | undefined;
  try {
    config = pinnedConfig
      ? await duplicateDirectory(pinnedConfig)
      : await openAbsolute(configPath);
    plugins = await child(config, "plugins");
    runtime = await child(config, RUNTIME);
    v = await child(runtime, version);
    const [ps, rs] = await Promise.all([
      plugins.stat({ bigint: true }),
      runtime.stat({ bigint: true }),
    ]);
    return {
      config,
      plugins,
      runtime,
      version: v,
      pluginsIdentity: { dev: ps.dev, ino: ps.ino },
      runtimeIdentity: { dev: rs.dev, ino: rs.ino },
    };
  } catch (e) {
    await closeAll([v, runtime, plugins, config]);
    throw e;
  }
}
async function source(e: InstallerEnvironment) {
  const root = await realpath(
      e.packageRoot ?? packageRootFromModule(import.meta.url),
    ),
    pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")),
    version = e.version ?? pkg.version,
    out: Payload[] = [];
  if (
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/.test(
      version,
    )
  )
    throw new Error("Invalid package version");
  const walk = async (base: string, rel: string) => {
    for (const d of await readdir(base, { withFileTypes: true })) {
      const r = `${rel}/${d.name}`,
        p = path.join(base, d.name);
      if (d.isSymbolicLink()) throw new Error(`Source symlink: ${r}`);
      if (d.isDirectory()) await walk(p, r);
      else if (d.isFile()) {
        const data = await readFile(p);
        out.push({ rel: r, data, sha256: sha(data) });
      } else throw new Error(`Unsupported source entry: ${r}`);
    }
  };
  for (const top of ["dist", "assets", "schemas"]) {
    try {
      await walk(path.join(root, top), top);
    } catch (x) {
      if ((x as NodeJS.ErrnoException).code !== "ENOENT") throw x;
    }
  }
  const metadata = Buffer.from(
    JSON.stringify(
      { name: pkg.name, version: pkg.version, type: "module" },
      null,
      2,
    ) + "\n",
  );
  out.push({ rel: "package.json", data: metadata, sha256: sha(metadata) });
  out.sort((a, b) => a.rel.localeCompare(b.rel));
  if (!out.some((x) => x.rel === "dist/plugin.js"))
    throw new Error("Built runtime entry is missing");
  return { version, payload: out };
}
function expected(
  scope: InstallScope,
  version: string,
  payload: Payload[],
  wrapper: string,
): OwnershipManifest {
  return {
    schemaVersion: 1,
    pluginId: PLUGIN_ID,
    packageVersion: version,
    scope,
    files: payload.map((x) => ({ path: x.rel, sha256: x.sha256 })),
    wrapper: {
      path: "plugins/senior-product-manager.js",
      sha256: sha(wrapper),
    },
  };
}
function strictManifest(data: Buffer, want: OwnershipManifest) {
  let got: unknown;
  try {
    got = JSON.parse(data.toString());
  } catch {
    throw new Error("Malformed ownership manifest");
  }
  if (JSON.stringify(got) !== JSON.stringify(want))
    throw new Error("Ownership manifest differs from package-source inventory");
  return got as OwnershipManifest;
}
async function locate(root: FileHandle, rel: string) {
  const parts = rel.split("/");
  if (parts.some((x) => !x || x === "." || x === ".." || x.includes("\\")))
    throw new Error(`Unsafe inventory path: ${rel}`);
  let dir = root;
  const opened: FileHandle[] = [];
  for (const p of parts.slice(0, -1)) {
    dir = await child(dir, p);
    opened.push(dir);
  }
  return { dir, name: parts.at(-1)!, opened };
}
async function inventory(
  root: FileHandle,
  payload: Payload[],
  wantManifest: OwnershipManifest,
) {
  const allowed = new Set([...payload.map((x) => x.rel), MANIFEST]);
  const seen = new Set<string>();
  const walk = async (d: FileHandle, prefix = "") => {
    for (const x of await entries(d)) {
      const rel = prefix ? `${prefix}/${x.name}` : x.name;
      if (x.isSymbolicLink()) throw new Error(`Installed symlink: ${rel}`);
      if (x.isDirectory()) {
        const c = await child(d, x.name);
        try {
          await walk(c, rel);
        } finally {
          await c.close();
        }
      } else if (x.isFile()) {
        if (!allowed.has(rel))
          throw new Error(`Unexpected installed file: ${rel}`);
        seen.add(rel);
      } else throw new Error(`Unexpected installed entry: ${rel}`);
    }
  };
  await walk(root);
  if (seen.size !== allowed.size)
    throw new Error("Installed inventory is incomplete");
  for (const p of payload) {
    const l = await locate(root, p.rel);
    try {
      const got = await bytes(l.dir, l.name);
      if (sha(got.data) !== p.sha256)
        throw new Error(`Installed hash mismatch: ${p.rel}`);
    } finally {
      await closeAll(l.opened);
    }
  }
  strictManifest((await bytes(root, MANIFEST)).data, wantManifest);
}
async function verify(
  tree: Tree,
  payload: Payload[],
  wrapper: string,
  want: OwnershipManifest,
) {
  const runtimeNames = (await entries(tree.runtime)).map((x) => x.name);
  if (runtimeNames.length !== 1 || runtimeNames[0] !== want.packageVersion)
    throw new Error("Unexpected runtime version tree");
  const w = await bytes(tree.plugins, WRAPPER);
  if (sha(w.data) !== sha(wrapper))
    throw new Error("Canonical wrapper mismatch");
  await inventory(tree.version, payload, want);
}
type ParentState =
  | "absent"
  | "present"
  | "missing_parent"
  | "parent_identity_changed";
async function observeParent(
  config: FileHandle,
  name: string,
  ownedName: string,
  want: Identity,
): Promise<{ state: ParentState; present: boolean }> {
  let current: FileHandle | undefined;
  try {
    current = await child(config, name);
    const s = await current.stat({ bigint: true }),
      changed = s.dev !== want.dev || s.ino !== want.ino,
      present = (await entries(current)).some((x) => x.name === ownedName);
    return {
      state: changed
        ? "parent_identity_changed"
        : present
          ? "present"
          : "absent",
      present,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return { state: "missing_parent", present: false };
    throw error;
  } finally {
    await current?.close().catch(() => undefined);
  }
}
async function activePathsFromConfig(tree: Tree, version: string) {
  const [wrapper, payload] = await Promise.all([
    observeParent(tree.config, "plugins", WRAPPER, tree.pluginsIdentity),
    observeParent(tree.config, RUNTIME, version, tree.runtimeIdentity),
  ]);
  return {
    wrapper: wrapper.present,
    payload: payload.present,
    wrapperState: wrapper.state,
    payloadState: payload.state,
    unsafe:
      wrapper.state === "parent_identity_changed" ||
      payload.state === "parent_identity_changed",
  };
}
async function restorationParent(
  tree: Tree,
  name: "plugins" | typeof RUNTIME,
  want: Identity,
) {
  let current: FileHandle | undefined;
  try {
    current = await child(tree.config, name);
    const s = await current.stat({ bigint: true });
    if (s.dev !== want.dev || s.ino !== want.ino)
      throw new Error(`${name} parent identity changed`);
    return current;
  } catch (error) {
    await current?.close().catch(() => undefined);
    throw new Error(
      `${name} restoration parent unavailable: ${(error as Error).message}`,
    );
  }
}
function recovery(
  configRoot: string,
  version: string,
  quarantine: string,
  diagnostic: string,
  restorationFailures: string[] = [],
) {
  return {
    configRoot,
    removedVersions: [] as string[],
    cleanupRequired: true,
    recoveryRequired: true,
    quarantine,
    diagnostic,
    restorationFailures,
  };
}
async function unlinkExact(dir: FileHandle, name: string, hash: string) {
  const first = await regular(dir, name);
  try {
    const data = await first.f.readFile();
    if (sha(data) !== hash) throw new Error(`Quarantine hash changed: ${name}`);
    const second = await regular(dir, name);
    try {
      if (first.s.dev !== second.s.dev || first.s.ino !== second.s.ino)
        throw new Error(`Quarantine identity changed: ${name}`);
    } finally {
      await second.f.close();
    }
    await unlink(fd(dir, name));
  } finally {
    await first.f.close();
  }
}
async function prune(root: FileHandle) {
  for (const x of await entries(root)) {
    if (!x.isDirectory())
      throw new Error(`Unexpected quarantine file: ${x.name}`);
    const c = await child(root, x.name);
    try {
      await prune(c);
    } finally {
      await c.close();
    }
    await rmdir(fd(root, x.name));
  }
}
async function deleteQuarantine(
  q: FileHandle,
  version: string,
  payload: Payload[],
  manifestHash: string,
  wrapperHash: string,
  hook?: InstallerEnvironment["hook"],
) {
  const v = await child(q, version);
  try {
    for (const p of [...payload].reverse()) {
      await hook?.(`before-delete:${p.rel}`);
      const l = await locate(v, p.rel);
      try {
        await unlinkExact(l.dir, l.name, p.sha256);
      } finally {
        await closeAll(l.opened);
      }
      await hook?.(`after-delete:${p.rel}`);
    }
    await hook?.(`before-delete:${MANIFEST}`);
    await unlinkExact(v, MANIFEST, manifestHash);
    await hook?.(`after-delete:${MANIFEST}`);
    await prune(v);
  } finally {
    await v.close();
  }
  await rmdir(fd(q, version));
  await hook?.("before-delete:wrapper");
  await unlinkExact(q, "wrapper.js", wrapperHash);
  await hook?.("after-delete:wrapper");
}

export async function uninstall(
  scope: InstallScope,
  project?: string,
  e: InstallerEnvironment = {},
  pinnedConfig?: FileHandle,
) {
  if ((e.platform ?? process.platform) !== "linux")
    throw new Error(
      "Installer secure IO is unsupported; no files were modified",
    );
  const { version, payload } = await source(e),
    assets: OwnedFile[] = payload
      .filter(
        (x) =>
          x.rel.startsWith("assets/agents/") ||
          x.rel.startsWith("assets/commands/"),
      )
      .map((x) => ({ path: x.rel, sha256: x.sha256 })),
    wrapper = generateWrapper(
      version,
      payload.find((x) => x.rel === "dist/plugin.js")!.sha256,
      assets,
    ),
    want = expected(scope, version, payload, wrapper),
    manifestText = JSON.stringify(want) + "\n",
    configPath = resolveConfigRoot(scope, project, e);
  let tree: Tree | undefined, q: FileHandle | undefined;
  const qName = `${Q_PREFIX}${version}-${randomBytes(8).toString("hex")}`;
  let movedWrapper = false,
    movedVersion = false,
    committed = false;
  try {
    tree = await openTree(configPath, version, pinnedConfig);
    await verify(tree, payload, wrapper, want);
    await e.hook?.("before-full-reverify");
    await verify(tree, payload, wrapper, want);
    if ((await entries(tree.config)).some((x) => x.name.startsWith(Q_PREFIX)))
      throw new Error(
        "Owned uninstall quarantine requires cleanup before uninstall",
      );
    await (
      await import("node:fs/promises")
    ).mkdir(fd(tree.config, qName), { mode: 0o700 });
    q = await child(tree.config, qName);
    await e.hook?.("before-move-wrapper");
    await rename(fd(tree.plugins, WRAPPER), fd(q, "wrapper.js"));
    movedWrapper = true;
    await e.hook?.("after-move-wrapper");
    await e.hook?.("before-move-payload");
    await rename(fd(tree.runtime, version), fd(q, version));
    movedVersion = true;
    await e.hook?.("after-both-moves");
    const qv = await child(q, version);
    try {
      await inventory(qv, payload, want);
    } finally {
      await qv.close();
    }
    if (sha((await bytes(q, "wrapper.js")).data) !== sha(wrapper))
      throw new Error("Quarantined wrapper mismatch");
    await e.hook?.("after-quarantine-verify-before-commit");
    const beforeCommit = await activePathsFromConfig(tree, version);
    if (beforeCommit.wrapper || beforeCommit.payload || beforeCommit.unsafe)
      return recovery(
        configPath,
        version,
        qName,
        `Inactive state is unproven before commit: wrapper=${beforeCommit.wrapperState}, payload=${beforeCommit.payloadState}`,
      );
    committed = true;
    try {
      await deleteQuarantine(
        q,
        version,
        payload,
        sha(manifestText),
        sha(wrapper),
        e.hook,
      );
      await e.hook?.("before-return-active-check");
      const beforeReturn = await activePathsFromConfig(tree, version);
      if (beforeReturn.wrapper || beforeReturn.payload || beforeReturn.unsafe)
        return recovery(
          configPath,
          version,
          qName,
          `Inactive state is unproven after cleanup: wrapper=${beforeReturn.wrapperState}, payload=${beforeReturn.payloadState}`,
        );
      await q.close();
      q = undefined;
      await rmdir(fd(tree.config, qName));
      if (!(await entries(tree.runtime)).length)
        await rmdir(fd(tree.config, RUNTIME));
      const finalActive = await activePathsFromConfig(tree, version);
      if (finalActive.wrapper || finalActive.payload || finalActive.unsafe)
        return {
          configRoot: configPath,
          removedVersions: [] as string[],
          cleanupRequired: true,
          recoveryRequired: true,
          diagnostic: `Active state is unsafe at the success boundary: wrapper=${finalActive.wrapperState}, payload=${finalActive.payloadState}`,
          restorationFailures: [] as string[],
        };
      return {
        configRoot: configPath,
        removedVersions: [version],
        cleanupRequired: false,
        recoveryRequired: false,
      };
    } catch (error) {
      const active = await activePathsFromConfig(tree, version);
      if (active.wrapper || active.payload || active.unsafe)
        return recovery(
          configPath,
          version,
          qName,
          `Cleanup failed and inactive state is unproven: wrapper=${active.wrapperState}, payload=${active.payloadState}; ${(error as Error).message}`,
        );
      return {
        configRoot: configPath,
        removedVersions: [version],
        cleanupRequired: true,
        recoveryRequired: false,
        quarantine: qName,
        diagnostic: `Plugin is inactive; owned quarantine cleanup is required: ${(error as Error).message}`,
      };
    }
  } catch (error) {
    if (!committed && q && tree) {
      const failures: string[] = [];
      if (movedVersion) {
        let parent: FileHandle | undefined;
        try {
          await e.hook?.("before-restore-payload");
          parent = await restorationParent(tree, RUNTIME, tree.runtimeIdentity);
          await rename(fd(q, version), fd(parent, version));
          movedVersion = false;
        } catch (x) {
          failures.push(`payload: ${(x as Error).message}`);
        } finally {
          await parent?.close().catch(() => undefined);
        }
      }
      if (movedWrapper) {
        let parent: FileHandle | undefined;
        try {
          await e.hook?.("before-restore-wrapper");
          parent = await restorationParent(
            tree,
            "plugins",
            tree.pluginsIdentity,
          );
          await rename(fd(q, "wrapper.js"), fd(parent, WRAPPER));
          movedWrapper = false;
        } catch (x) {
          failures.push(`wrapper: ${(x as Error).message}`);
        } finally {
          await parent?.close().catch(() => undefined);
        }
      }
      if (failures.length)
        return recovery(
          configPath,
          version,
          qName,
          `Pre-commit failure and restoration was incomplete: ${(error as Error).message}`,
          failures,
        );
      await q.close();
      q = undefined;
      try {
        await rmdir(fd(tree.config, qName));
      } catch (x) {
        return recovery(
          configPath,
          version,
          qName,
          `Active paths restored but quarantine removal failed: ${(x as Error).message}`,
          [`quarantine: ${(x as Error).message}`],
        );
      }
    }
    throw error;
  } finally {
    await q?.close().catch(() => undefined);
    if (tree)
      await closeAll([tree.version, tree.runtime, tree.plugins, tree.config]);
  }
}
