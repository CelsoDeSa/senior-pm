import { constants } from "node:fs";
import { createHash } from "node:crypto";
import {
  mkdir,
  open,
  readFile,
  realpath,
  type FileHandle,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { uninstall as uninstallNeutral } from "./transactional.js";
import {
  migrateKnownLegacyInstall,
  ownedInstallationPresence,
  readLegacyFingerprint,
  type LegacyFingerprint,
} from "./legacy-migration.js";
export { uninstallNeutral as uninstall };
import { PLUGIN_ID } from "../shared/constants.js";

export { PLUGIN_ID };
export const MANIFEST_SCHEMA = 1;
export type InstallScope = "project" | "user";
export interface InstallerEnvironment {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  home?: string;
  packageRoot?: string;
  version?: string;
  failAfterFiles?: number;
  hook?: (point: string) => void | Promise<void>;
}
export interface OwnedFile {
  path: string;
  sha256: string;
}
export interface OwnershipManifest {
  schemaVersion: 1;
  pluginId: string;
  packageVersion: string;
  scope: InstallScope;
  files: OwnedFile[];
  wrapper: OwnedFile;
}
export interface InstallResult {
  configRoot: string;
  version: string;
  idempotent: boolean;
  migratedFrom?: "0.1.0";
  cleanupRequired?: boolean;
  recoveryRequired?: boolean;
  quarantine?: string;
  diagnostic?: string;
  restorationFailures?: string[];
}
type Payload = { rel: string; data: Buffer; sha256: string };
type Created = {
  parent: FileHandle;
  name: string;
  kind: "file" | "dir";
  dev: bigint;
  ino: bigint;
  sha256?: string;
};

const WRAPPER_REL = "plugins/senior-product-manager.js";
const RUNTIME = "senior-pm-runtime";
const MANIFEST = "ownership.json";
const KNOWN_LEGACY_FINGERPRINT_SHA256 =
  "6d69542964764d38a8ab90180e57e37c0651456444613d34eb7dfe8739a33a6c";
const VERSION_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/;
const HEX_RE = /^[a-f0-9]{64}$/;
const ALLOWED_TOP = new Set(["dist", "assets", "schemas", "package.json"]);
const sha = (data: Uint8Array | string) =>
  createHash("sha256").update(data).digest("hex");
const fdPath = (fd: FileHandle, name?: string) =>
  `/proc/self/fd/${fd.fd}${name === undefined ? "" : `/${child(name)}`}`;
const child = (name: string) => {
  if (
    !name ||
    name === "." ||
    name === ".." ||
    name.includes("/") ||
    name.includes("\\") ||
    name.includes("\0")
  )
    throw new Error(`Unsafe path component: ${name}`);
  return name;
};
const safeRel = (value: string) => {
  if (
    !value ||
    path.isAbsolute(value) ||
    /^[A-Za-z]:/.test(value) ||
    value.startsWith("\\\\")
  )
    throw new Error(`Unsafe relative path: ${value}`);
  const p = value.split(/[\\/]/);
  p.forEach(child);
  return p.join("/");
};
const validVersion = (v: string) => {
  if (!VERSION_RE.test(v)) throw new Error(`Invalid package version: ${v}`);
  return v;
};
const assertLinux = (p: NodeJS.Platform) => {
  if (p !== "linux")
    throw new Error(
      `Installer secure IO is unsupported on ${p}; no files were modified`,
    );
};

export function generateWrapper(
  version: string,
  entryHash: string,
  assets: OwnedFile[] = [],
) {
  validVersion(version);
  if (!HEX_RE.test(entryHash)) throw new Error("Invalid runtime entry hash");
  for (const a of assets) {
    safeRel(a.path);
    if (
      !HEX_RE.test(a.sha256) ||
      (!a.path.startsWith("assets/agents/") &&
        !a.path.startsWith("assets/commands/"))
    )
      throw new Error("Invalid runtime asset identity");
  }
  const identities = [{ path: "dist/plugin.js", sha256: entryHash }, ...assets];
  return `// Owned by ${PLUGIN_ID}. Do not edit.\nimport fs from "node:fs/promises";\nimport crypto from "node:crypto";\nimport path from "node:path";\nimport { fileURLToPath, pathToFileURL } from "node:url";\nconst root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../${RUNTIME}/${version}");\nconst expected=${JSON.stringify(identities)};\nfor(const item of expected){const target=path.join(root,...item.path.split("/"));const stat=await fs.lstat(target);if(!stat.isFile()||stat.isSymbolicLink())throw new Error("Senior PM runtime asset is not a regular file: "+item.path);const bytes=await fs.readFile(target);if(crypto.createHash("sha256").update(bytes).digest("hex")!==item.sha256)throw new Error("Senior PM runtime integrity check failed: "+item.path);}\nconst runtime=await import(pathToFileURL(path.join(root,"dist/plugin.js")).href);\nexport default runtime.default;\nexport const SeniorProductManagerPlugin=runtime.SeniorProductManagerPlugin||runtime.default;\n`;
}

async function pinDirectory(p: string) {
  const h = await open(
    p,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
  );
  const s = await h.stat({ bigint: true });
  if (!s.isDirectory()) {
    await h.close();
    throw new Error(`Not a directory: ${p}`);
  }
  return h;
}
async function duplicateDirectory(parent: FileHandle) {
  const h = await open(
    `/proc/self/fd/${parent.fd}`,
    constants.O_RDONLY | constants.O_DIRECTORY,
  );
  const a = await parent.stat({ bigint: true }),
    b = await h.stat({ bigint: true });
  if (a.dev !== b.dev || a.ino !== b.ino) {
    await h.close();
    throw new Error("Pinned directory identity changed");
  }
  return h;
}
async function pinAbsolute(
  target: string,
  created: Created[],
  create: boolean,
) {
  if (!path.isAbsolute(target)) throw new Error("Config root must be absolute");
  let current = await pinDirectory(path.parse(target).root);
  try {
    for (const part of target
      .slice(path.parse(target).root.length)
      .split(path.sep)
      .filter(Boolean)) {
      let next: FileHandle;
      try {
        next = await pinDirectory(fdPath(current, part));
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT" || !create) throw e;
        await mkdir(fdPath(current, part), { mode: 0o700 });
        next = await pinDirectory(fdPath(current, part));
        const s = await next.stat({ bigint: true }),
          owner = await duplicateDirectory(current);
        created.push({
          parent: owner,
          name: part,
          kind: "dir",
          dev: s.dev,
          ino: s.ino,
        });
      }
      await current.close();
      current = next;
    }
    return current;
  } catch (e) {
    await current.close();
    throw e;
  }
}
async function pinChild(parent: FileHandle, name: string) {
  return pinDirectory(fdPath(parent, name));
}
async function list(dir: FileHandle) {
  return (await import("node:fs/promises")).readdir(fdPath(dir), {
    withFileTypes: true,
  });
}
async function createDir(parent: FileHandle, name: string, created: Created[]) {
  await mkdir(fdPath(parent, name), { mode: 0o700 });
  const h = await pinChild(parent, name),
    s = await h.stat({ bigint: true }),
    ownedParent = await duplicateDirectory(parent);
  created.push({
    parent: ownedParent,
    name,
    kind: "dir",
    dev: s.dev,
    ino: s.ino,
  });
  return h;
}
async function openRegular(
  parent: FileHandle,
  name: string,
  flags = constants.O_RDONLY,
) {
  const h = await open(fdPath(parent, name), flags | constants.O_NOFOLLOW);
  const s = await h.stat({ bigint: true });
  if (!s.isFile()) {
    await h.close();
    throw new Error(`Not a regular file: ${name}`);
  }
  return { h, s };
}
async function createFile(
  parent: FileHandle,
  name: string,
  data: Buffer | string,
  created: Created[],
  hook?: InstallerEnvironment["hook"],
) {
  const h = await open(
    fdPath(parent, name),
    constants.O_WRONLY |
      constants.O_CREAT |
      constants.O_EXCL |
      constants.O_NOFOLLOW,
    0o600,
  );
  let record: Created | undefined;
  try {
    const s = await h.stat({ bigint: true }),
      ownedParent = await duplicateDirectory(parent);
    record = {
      parent: ownedParent,
      name,
      kind: "file",
      dev: s.dev,
      ino: s.ino,
    };
    created.push(record);
    await hook?.(`after-exclusive-open:${name}`);
    await h.writeFile(data);
    record.sha256 = sha(data);
    await hook?.(`after-write:${name}`);
    await h.sync();
    await hook?.(`after-sync:${name}`);
  } finally {
    await h.close();
  }
}
async function readPinned(parent: FileHandle, name: string) {
  const { h, s } = await openRegular(parent, name);
  try {
    return { data: await h.readFile(), stat: s };
  } finally {
    await h.close();
  }
}
async function unlinkVerified(
  parent: FileHandle,
  name: string,
  expected: string,
) {
  const { h, s } = await openRegular(parent, name);
  try {
    const data = await h.readFile();
    if (sha(data) !== expected) throw new Error(`Owned file modified: ${name}`);
    const again = await openRegular(parent, name);
    try {
      if (again.s.dev !== s.dev || again.s.ino !== s.ino)
        throw new Error(`File identity changed: ${name}`);
    } finally {
      await again.h.close();
    }
    await (await import("node:fs/promises")).unlink(fdPath(parent, name));
  } finally {
    await h.close();
  }
}
async function removeEmpty(
  parent: FileHandle,
  name: string,
  expected?: { dev: bigint; ino: bigint },
) {
  const h = await pinChild(parent, name);
  try {
    const s = await h.stat({ bigint: true });
    if (expected && (s.dev !== expected.dev || s.ino !== expected.ino))
      throw new Error(`Directory identity changed: ${name}`);
    if ((await list(h)).length)
      throw new Error(`Directory is not empty: ${name}`);
    await (await import("node:fs/promises")).rmdir(fdPath(parent, name));
  } finally {
    await h.close();
  }
}

export function resolveConfigRoot(
  scope: InstallScope,
  project = process.cwd(),
  e: InstallerEnvironment = {},
) {
  const platform = e.platform ?? process.platform,
    env = e.env ?? process.env,
    home = e.home ?? os.homedir();
  if (scope === "project") return path.resolve(project, ".opencode");
  if (env.OPENCODE_CONFIG_DIR) return path.resolve(env.OPENCODE_CONFIG_DIR);
  if (platform === "win32")
    return path.resolve(
      env.APPDATA || path.join(home, "AppData", "Roaming"),
      "opencode",
    );
  return path.resolve(
    env.XDG_CONFIG_HOME || path.join(home, ".config"),
    "opencode",
  );
}
export function packageRootFromModule(moduleUrl: string) {
  const dir = path.dirname(fileURLToPath(moduleUrl));
  return path.basename(dir) === "installer"
    ? path.resolve(dir, "../..")
    : path.resolve(dir, "..");
}
async function sourceRoot(e: InstallerEnvironment) {
  return realpath(e.packageRoot ?? packageRootFromModule(import.meta.url));
}
async function collect(root: string, e: InstallerEnvironment) {
  const pkg = JSON.parse(
      await readFile(path.join(root, "package.json"), "utf8"),
    ),
    version = validVersion(e.version ?? pkg.version),
    out: Payload[] = [];
  const walk = async (dir: string, rel: string) => {
    const entries = await (
      await import("node:fs/promises")
    ).readdir(dir, { withFileTypes: true });
    for (const d of entries) {
      const r = safeRel(`${rel}/${d.name}`),
        p = path.join(dir, d.name);
      if (d.isSymbolicLink())
        throw new Error(`Payload source contains symlink: ${r}`);
      if (d.isDirectory()) await walk(p, r);
      else if (d.isFile()) {
        const data = await readFile(p);
        out.push({ rel: r, data, sha256: sha(data) });
      } else throw new Error(`Unsupported payload source: ${r}`);
    }
  };
  for (const top of ["dist", "assets", "schemas"]) {
    try {
      await walk(path.join(root, top), top);
    } catch (x) {
      if ((x as NodeJS.ErrnoException).code !== "ENOENT") throw x;
    }
  }
  const data = Buffer.from(
    JSON.stringify(
      { name: pkg.name, version: pkg.version, type: "module" },
      null,
      2,
    ) + "\n",
  );
  out.push({ rel: "package.json", data, sha256: sha(data) });
  out.sort((a, b) => a.rel.localeCompare(b.rel));
  if (!out.some((x) => x.rel === "dist/plugin.js"))
    throw new Error("Built runtime entry dist/plugin.js is missing");
  return { version, payload: out };
}
function expectedManifest(
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
    wrapper: { path: WRAPPER_REL, sha256: sha(wrapper) },
  };
}
function parseManifest(data: Buffer, expected: OwnershipManifest) {
  let raw: unknown;
  try {
    raw = JSON.parse(data.toString("utf8"));
  } catch {
    throw new Error("Ownership manifest is malformed");
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("Ownership manifest is invalid");
  const m = raw as Record<string, unknown>;
  if (
    Object.keys(m).sort().join(",") !==
    "files,packageVersion,pluginId,schemaVersion,scope,wrapper"
  )
    throw new Error("Ownership manifest has unexpected fields");
  if (JSON.stringify(raw) !== JSON.stringify(expected))
    throw new Error("Ownership manifest does not match this package payload");
  for (const f of (raw as OwnershipManifest).files) {
    safeRel(f.path);
    if (!ALLOWED_TOP.has(f.path.split("/")[0]!))
      throw new Error(`Unexpected manifest path: ${f.path}`);
    if (!HEX_RE.test(f.sha256)) throw new Error("Invalid manifest hash");
  }
  return raw as OwnershipManifest;
}
async function openTree(config: FileHandle, version: string) {
  let plugins: FileHandle | undefined,
    runtime: FileHandle | undefined,
    versionDir: FileHandle | undefined;
  try {
    plugins = await pinChild(config, "plugins");
    runtime = await pinChild(config, RUNTIME);
    versionDir = await pinChild(runtime, version);
    return { plugins, runtime, versionDir };
  } catch (error) {
    await Promise.allSettled(
      [plugins?.close(), runtime?.close(), versionDir?.close()].filter(
        Boolean,
      ) as Promise<void>[],
    );
    throw error;
  }
}
async function closeTree(t?: {
  plugins: FileHandle;
  runtime: FileHandle;
  versionDir: FileHandle;
}) {
  await Promise.allSettled(
    [t?.plugins.close(), t?.runtime.close(), t?.versionDir.close()].filter(
      Boolean,
    ) as Promise<void>[],
  );
}
async function verifyInstalled(
  config: FileHandle,
  scope: InstallScope,
  version: string,
  payload: Payload[],
  wrapper: string,
  hook?: InstallerEnvironment["hook"],
) {
  const tree = await openTree(config, version);
  try {
    const rootEntries = (await list(tree.runtime)).map((x) => x.name);
    if (rootEntries.length !== 1 || rootEntries[0] !== version)
      throw new Error(
        "A different or unexpected runtime tree is installed; run verified uninstall before install",
      );
    const wrapperRead = await readPinned(
      tree.plugins,
      "senior-product-manager.js",
    );
    if (sha(wrapperRead.data) !== sha(wrapper))
      throw new Error("Canonical wrapper verification failed");
    const manifestRead = await readPinned(tree.versionDir, MANIFEST);
    const manifest = parseManifest(
      manifestRead.data,
      expectedManifest(scope, version, payload, wrapper),
    );
    await hook?.("after-manifest-read");
    const expectedFiles = new Set([
      ...manifest.files.map((x) => x.path),
      MANIFEST,
    ]);
    const walk = async (dir: FileHandle, prefix = "") => {
      for (const d of await list(dir)) {
        const rel = prefix ? `${prefix}/${d.name}` : d.name;
        if (d.isSymbolicLink())
          throw new Error(`Symlink in installed payload: ${rel}`);
        if (d.isDirectory()) {
          const c = await pinChild(dir, d.name);
          try {
            await walk(c, rel);
          } finally {
            await c.close();
          }
        } else if (d.isFile()) {
          if (!expectedFiles.has(rel))
            throw new Error(`Unexpected installed file: ${rel}`);
        } else throw new Error(`Unexpected installed entry: ${rel}`);
      }
    };
    await walk(tree.versionDir);
    for (const f of payload) {
      let dir = tree.versionDir;
      const opened: FileHandle[] = [];
      try {
        const parts = f.rel.split("/");
        for (const p of parts.slice(0, -1)) {
          dir = await pinChild(dir, p);
          opened.push(dir);
        }
        const got = await readPinned(dir, parts.at(-1)!);
        if (sha(got.data) !== f.sha256)
          throw new Error(`Owned payload modified or missing: ${f.rel}`);
      } finally {
        await Promise.allSettled(opened.map((x) => x.close()));
      }
    }
    return { tree, manifest };
  } catch (e) {
    await closeTree(tree);
    throw e;
  }
}
async function rollback(created: Created[]) {
  for (const x of created.reverse()) {
    try {
      if (x.kind === "file") {
        if (x.sha256) await unlinkVerified(x.parent, x.name, x.sha256);
        else {
          const got = await openRegular(x.parent, x.name);
          try {
            if (got.s.dev !== x.dev || got.s.ino !== x.ino)
              throw new Error("Created file identity changed");
            await (
              await import("node:fs/promises")
            ).unlink(fdPath(x.parent, x.name));
          } finally {
            await got.h.close();
          }
        }
      } else await removeEmpty(x.parent, x.name, { dev: x.dev, ino: x.ino });
    } catch {
      /* fail closed: never remove a mutated rollback target */
    } finally {
      await x.parent.close().catch(() => undefined);
    }
  }
}

async function installCore(
  scope: InstallScope,
  project?: string,
  e: InstallerEnvironment = {},
  pinnedConfig?: FileHandle,
) {
  assertLinux(e.platform ?? process.platform);
  const src = await sourceRoot(e),
    { version, payload } = await collect(src, e),
    entry = payload.find((x) => x.rel === "dist/plugin.js")!,
    wrapper = generateWrapper(
      version,
      entry.sha256,
      payload
        .filter(
          (x) =>
            x.rel.startsWith("assets/agents/") ||
            x.rel.startsWith("assets/commands/"),
        )
        .map((x) => ({ path: x.rel, sha256: x.sha256 })),
    ),
    created: Created[] = [];
  let config: FileHandle | undefined,
    plugins: FileHandle | undefined,
    runtime: FileHandle | undefined,
    versionDir: FileHandle | undefined,
    count = 0;
  try {
    config = pinnedConfig
      ? await duplicateDirectory(pinnedConfig)
      : await pinAbsolute(resolveConfigRoot(scope, project, e), created, true);
    await e.hook?.("after-config-pinned");
    const names = (await list(config)).map((x) => x.name);
    if (names.includes(RUNTIME))
      throw new Error(
        "Install refused: namespaced runtime already exists; verified uninstall is required",
      );
    if (names.includes("plugins")) {
      const check = await pinChild(config, "plugins");
      try {
        if (
          (await list(check)).some(
            (x) => x.name === "senior-product-manager.js",
          )
        )
          throw new Error(
            "Install refused: Senior PM wrapper already exists; verified uninstall is required",
          );
      } finally {
        await check.close();
      }
    }
    if (names.includes("plugins")) {
      plugins = await pinChild(config, "plugins");
      if (
        (await list(plugins)).some(
          (x) => x.name === "senior-product-manager.js",
        )
      ) {
        try {
          const verified = await verifyInstalled(
            config,
            scope,
            version,
            payload,
            wrapper,
            e.hook,
          );
          await closeTree(verified.tree);
          return {
            configRoot: resolveConfigRoot(scope, project, e),
            version,
            idempotent: true,
          };
        } catch (err) {
          throw new Error(
            `Install refused: ${(err as Error).message}; verified uninstall is required before installing a different version`,
          );
        }
      }
    } else plugins = await createDir(config, "plugins", created);
    if (names.includes(RUNTIME))
      throw new Error(
        "Install refused: preexisting namespaced runtime tree is unowned; verified uninstall is required",
      );
    runtime = await createDir(config, RUNTIME, created);
    versionDir = await createDir(runtime, version, created);
    for (const f of payload) {
      let dir = versionDir;
      const opened: FileHandle[] = [];
      try {
        for (const p of f.rel.split("/").slice(0, -1)) {
          const found = (await list(dir)).some((x) => x.name === p);
          dir = found
            ? await pinChild(dir, p)
            : await createDir(dir, p, created);
          opened.push(dir);
        }
        await createFile(
          dir,
          f.rel.split("/").at(-1)!,
          f.data,
          created,
          e.hook,
        );
        if (e.failAfterFiles !== undefined && ++count >= e.failAfterFiles)
          throw new Error("Injected interrupted staging failure");
      } finally {
        await Promise.allSettled(opened.map((x) => x.close()));
      }
    }
    await createFile(
      plugins,
      "senior-product-manager.js",
      wrapper,
      created,
      e.hook,
    );
    const manifest = expectedManifest(scope, version, payload, wrapper);
    await createFile(
      versionDir,
      MANIFEST,
      JSON.stringify(manifest) + "\n",
      created,
      e.hook,
    );
    return {
      configRoot: resolveConfigRoot(scope, project, e),
      version,
      idempotent: false,
    };
  } catch (err) {
    await rollback(created);
    throw err;
  } finally {
    await Promise.allSettled(
      [
        ...created.map((x) => x.parent.close()),
        config?.close(),
        plugins?.close(),
        runtime?.close(),
        versionDir?.close(),
      ].filter(Boolean) as Promise<void>[],
    );
  }
}

async function verifyNeutralCore(
  scope: InstallScope,
  project: string | undefined,
  e: InstallerEnvironment,
  pinnedConfig: FileHandle,
) {
  const src = await sourceRoot(e);
  const { version, payload } = await collect(src, e);
  const entry = payload.find((item) => item.rel === "dist/plugin.js")!;
  const wrapper = generateWrapper(
    version,
    entry.sha256,
    payload
      .filter(
        (item) =>
          item.rel.startsWith("assets/agents/") ||
          item.rel.startsWith("assets/commands/"),
      )
      .map((item) => ({ path: item.rel, sha256: item.sha256 })),
  );
  const config = await duplicateDirectory(pinnedConfig);
  try {
    const verified = await verifyInstalled(
      config,
      scope,
      version,
      payload,
      wrapper,
      e.hook,
    );
    await closeTree(verified.tree);
  } finally {
    await config.close();
  }
}

export async function install(
  scope: InstallScope,
  project?: string,
  e: InstallerEnvironment = {},
): Promise<InstallResult> {
  assertLinux(e.platform ?? process.platform);
  const { hook: _migrationHook, ...environmentWithoutHook } = e;
  const configRoot = resolveConfigRoot(scope, project, e),
    presence = await ownedInstallationPresence(configRoot);
  if (!presence.wrapper && !presence.runtime)
    return installCore(scope, project, e);
  if (!presence.wrapper || !presence.runtime)
    throw new Error(
      "Install refused: partial Senior PM installation is not migration-eligible",
    );
  const src = await sourceRoot(e),
    fingerprintPath = path.join(
      src,
      "assets/compatibility/known-legacy-0.1.0-fingerprint.json",
    );
  let fingerprint: LegacyFingerprint;
  try {
    fingerprint = await readLegacyFingerprint(
      fingerprintPath,
      KNOWN_LEGACY_FINGERPRINT_SHA256,
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      throw new Error(
        "Install refused: existing installation is not eligible for the frozen legacy migration; verified uninstall is required",
      );
    throw error;
  }
  const result = await migrateKnownLegacyInstall(
    configRoot,
    fingerprint,
    (pinnedConfig) => installCore(scope, project, e, pinnedConfig),
    (pinnedConfig) => verifyNeutralCore(scope, project, e, pinnedConfig),
    (pinnedConfig) =>
      uninstallNeutral(scope, project, environmentWithoutHook, pinnedConfig),
    e.hook,
  );
  return { configRoot, version: "0.1.0", idempotent: false, ...result };
}

export async function diagnoseUninstall(
  scope: InstallScope,
  project?: string,
  e: InstallerEnvironment = {},
) {
  assertLinux(e.platform ?? process.platform);
  const src = await sourceRoot(e),
    { version, payload } = await collect(src, e),
    wrapper = generateWrapper(
      version,
      payload.find((x) => x.rel === "dist/plugin.js")!.sha256,
      payload
        .filter(
          (x) =>
            x.rel.startsWith("assets/agents/") ||
            x.rel.startsWith("assets/commands/"),
        )
        .map((x) => ({ path: x.rel, sha256: x.sha256 })),
    ),
    created: Created[] = [];
  let config: FileHandle | undefined;
  try {
    config = await pinAbsolute(
      resolveConfigRoot(scope, project, e),
      created,
      false,
    );
    if (created.length) throw new Error("No owned installation found");
    const verified = await verifyInstalled(
      config,
      scope,
      version,
      payload,
      wrapper,
      e.hook,
    );
    await closeTree(verified.tree);
    return {
      configRoot: resolveConfigRoot(scope, project, e),
      version,
      blockers: [] as string[],
    };
  } catch (err) {
    return {
      configRoot: resolveConfigRoot(scope, project, e),
      version,
      blockers: [(err as Error).message],
    };
  } finally {
    await rollback(created);
    await config?.close();
  }
}
async function uninstallLegacy(
  scope: InstallScope,
  project?: string,
  e: InstallerEnvironment = {},
) {
  assertLinux(e.platform ?? process.platform);
  const src = await sourceRoot(e),
    { version, payload } = await collect(src, e),
    wrapper = generateWrapper(
      version,
      payload.find((x) => x.rel === "dist/plugin.js")!.sha256,
      payload
        .filter(
          (x) =>
            x.rel.startsWith("assets/agents/") ||
            x.rel.startsWith("assets/commands/"),
        )
        .map((x) => ({ path: x.rel, sha256: x.sha256 })),
    ),
    created: Created[] = [];
  let config: FileHandle | undefined;
  try {
    config = await pinAbsolute(
      resolveConfigRoot(scope, project, e),
      created,
      false,
    );
    if (created.length)
      throw new Error("Uninstall refused: no owned installation found");
    const { tree } = await verifyInstalled(
      config,
      scope,
      version,
      payload,
      wrapper,
      e.hook,
    );
    try {
      await e.hook?.("before-delete");
      for (const f of [...payload].reverse()) {
        let dir = tree.versionDir;
        const opened: FileHandle[] = [];
        try {
          for (const p of f.rel.split("/").slice(0, -1)) {
            dir = await pinChild(dir, p);
            opened.push(dir);
          }
          await unlinkVerified(dir, f.rel.split("/").at(-1)!, f.sha256);
        } finally {
          await Promise.allSettled(opened.map((x) => x.close()));
        }
      }
      await unlinkVerified(
        tree.versionDir,
        MANIFEST,
        sha(
          JSON.stringify(expectedManifest(scope, version, payload, wrapper)) +
            "\n",
        ),
      );
      const prune = async (dir: FileHandle, prefix = "") => {
        for (const d of await list(dir)) {
          if (!d.isDirectory())
            throw new Error(
              `Unexpected file appeared during uninstall: ${prefix}${d.name}`,
            );
          const c = await pinChild(dir, d.name);
          try {
            await prune(c, `${prefix}${d.name}/`);
          } finally {
            await c.close();
          }
          await removeEmpty(dir, d.name);
        }
      };
      await prune(tree.versionDir);
      await unlinkVerified(
        tree.plugins,
        "senior-product-manager.js",
        sha(wrapper),
      );
      await removeEmpty(tree.runtime, version);
      await removeEmpty(config, RUNTIME);
      return {
        configRoot: resolveConfigRoot(scope, project, e),
        removedVersions: [version],
      };
    } finally {
      await closeTree(tree);
    }
  } finally {
    await rollback(created);
    await config?.close();
  }
}
