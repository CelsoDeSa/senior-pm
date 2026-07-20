import { constants } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import {
  lstat,
  open,
  readFile,
  readdir,
  rename,
  rmdir,
  unlink,
  mkdir,
  type FileHandle,
} from "node:fs/promises";
import path from "node:path";

export type LegacyFingerprintEntry = {
  path: string;
  type: "file" | "directory";
  mode: number;
  sha256?: string;
};

export type LegacyFingerprint = {
  schemaVersion: 1;
  legacyVersion: "0.1.0";
  legacyPluginId: "elon-musk-agents.senior-product-manager";
  wrapper: LegacyFingerprintEntry;
  runtimeRoot: "senior-pm-runtime";
  runtimeVersions: ["0.1.0"];
  entries: LegacyFingerprintEntry[];
  requirements: { zeroSymlinks: true; zeroExtraRuntimeEntries: true };
};

type Identity = { dev: bigint; ino: bigint };
type Snapshot = { entry: LegacyFingerprintEntry; identity: Identity };
type LegacyTree = {
  configRoot: string;
  config: FileHandle;
  plugins: FileHandle;
  runtime: FileHandle;
  version: FileHandle;
  configIdentity: Identity;
  pluginsIdentity: Identity;
  runtimeIdentity: Identity;
  versionIdentity: Identity;
  wrapperIdentity: Identity;
};

export type LegacyMigrationResult = {
  migratedFrom: "0.1.0";
  cleanupRequired: boolean;
  recoveryRequired: boolean;
  quarantine?: string;
  diagnostic?: string;
  restorationFailures?: string[];
};

const WRAPPER_DIRECTORY = "plugins";
const WRAPPER_NAME = "senior-product-manager.js";
const WRAPPER = `${WRAPPER_DIRECTORY}/${WRAPPER_NAME}`;
const RUNTIME = "senior-pm-runtime";
const VERSION = "0.1.0";
const QUARANTINE_PREFIX = ".senior-pm-legacy-migration-";
const sha256 = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const mode = (value: number | bigint) => Number(value) & 0o777;
const identity = (stat: { dev: bigint; ino: bigint }): Identity => ({
  dev: stat.dev,
  ino: stat.ino,
});
const sameIdentity = (left: Identity, right: Identity) =>
  left.dev === right.dev && left.ino === right.ino;
const canonical = (value: unknown) => JSON.stringify(value);
const canonicalEntries = (entries: LegacyFingerprintEntry[]) =>
  canonical(
    entries
      .map((entry) => ({
        mode: entry.mode,
        path: entry.path,
        ...(entry.sha256 ? { sha256: entry.sha256 } : {}),
        type: entry.type,
      }))
      .sort((left, right) => left.path.localeCompare(right.path)),
  );

function component(value: string) {
  if (
    !value ||
    value === "." ||
    value === ".." ||
    value.includes("/") ||
    value.includes("\\") ||
    value.includes("\0")
  )
    throw new Error(`Unsafe legacy path component: ${value}`);
  return value;
}

function safeRelative(value: string) {
  if (
    !value ||
    path.isAbsolute(value) ||
    /^[A-Za-z]:/.test(value) ||
    value.startsWith("\\\\")
  )
    throw new Error(`Unsafe legacy fingerprint path: ${value}`);
  return value.split("/").map(component);
}

const fdPath = (directory: FileHandle, name?: string) =>
  `/proc/self/fd/${directory.fd}${name === undefined ? "" : `/${component(name)}`}`;

async function pinDirectory(target: string) {
  const handle = await open(
    target,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
  );
  try {
    const stat = await handle.stat({ bigint: true });
    if (!stat.isDirectory())
      throw new Error("Pinned legacy path is not a directory");
    return handle;
  } catch (error) {
    await handle.close();
    throw error;
  }
}

async function duplicateDirectory(directory: FileHandle) {
  const duplicate = await open(
    fdPath(directory),
    constants.O_RDONLY | constants.O_DIRECTORY,
  );
  try {
    const [expected, actual] = await Promise.all([
      directory.stat({ bigint: true }),
      duplicate.stat({ bigint: true }),
    ]);
    if (expected.dev !== actual.dev || expected.ino !== actual.ino)
      throw new Error("Pinned legacy directory identity changed");
    return duplicate;
  } catch (error) {
    await duplicate.close();
    throw error;
  }
}

async function pinAbsolute(target: string) {
  if (!path.isAbsolute(target))
    throw new Error("Legacy config root must be absolute");
  const parsed = path.parse(target);
  let current = await pinDirectory(parsed.root);
  try {
    for (const part of target
      .slice(parsed.root.length)
      .split(path.sep)
      .filter(Boolean)) {
      const next = await pinDirectory(fdPath(current, part));
      await current.close();
      current = next;
    }
    return current;
  } catch (error) {
    await current.close();
    throw error;
  }
}

async function child(directory: FileHandle, name: string) {
  return pinDirectory(fdPath(directory, name));
}
async function entries(directory: FileHandle) {
  return readdir(fdPath(directory), { withFileTypes: true });
}

async function regular(directory: FileHandle, name: string) {
  const handle = await open(
    fdPath(directory, name),
    constants.O_RDONLY | constants.O_NOFOLLOW,
  );
  try {
    const stat = await handle.stat({ bigint: true });
    if (!stat.isFile())
      throw new Error(
        `Legacy migration refused: ${name} is not a regular file`,
      );
    return { handle, stat };
  } catch (error) {
    await handle.close();
    throw error;
  }
}

async function closeAll(handles: Array<FileHandle | undefined>) {
  await Promise.allSettled(
    handles.filter(Boolean).map((handle) => handle!.close()),
  );
}

async function assertHandleIdentity(
  handle: FileHandle,
  expected: Identity,
  label: string,
) {
  const actual = identity(await handle.stat({ bigint: true }));
  if (!sameIdentity(actual, expected))
    throw new Error(`Legacy migration refused: ${label} identity changed`);
}

async function assertAbsoluteIdentity(
  target: string,
  expected: Identity,
  label: string,
) {
  let current: FileHandle | undefined;
  try {
    current = await pinAbsolute(target);
    await assertHandleIdentity(current, expected, label);
  } finally {
    await current?.close().catch(() => undefined);
  }
}

async function assertChildIdentity(
  parent: FileHandle,
  name: string,
  expected: Identity,
  label: string,
) {
  let current: FileHandle | undefined;
  try {
    current = await child(parent, name);
    await assertHandleIdentity(current, expected, label);
  } finally {
    await current?.close().catch(() => undefined);
  }
}

async function assertRegularIdentity(
  parent: FileHandle,
  name: string,
  expected: Identity,
  label: string,
) {
  const current = await regular(parent, name);
  try {
    if (!sameIdentity(identity(current.stat), expected))
      throw new Error(`Legacy migration refused: ${label} identity changed`);
  } finally {
    await current.handle.close();
  }
}

async function presentAt(parent: FileHandle, name: string) {
  try {
    await lstat(fdPath(parent, name));
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function snapshotVersion(version: FileHandle): Promise<Snapshot[]> {
  const output: Snapshot[] = [];
  const walk = async (
    directory: FileHandle,
    relative = `${RUNTIME}/${VERSION}`,
  ) => {
    for (const entry of (await entries(directory)).sort((left, right) =>
      left.name.localeCompare(right.name),
    )) {
      const entryPath = `${relative}/${entry.name}`;
      if (entry.isSymbolicLink())
        throw new Error(
          `Legacy migration refused: symlink found at ${entryPath}`,
        );
      if (entry.isDirectory()) {
        const pinned = await child(directory, entry.name);
        try {
          const stat = await pinned.stat({ bigint: true });
          output.push({
            entry: {
              path: entryPath,
              type: "directory",
              mode: mode(stat.mode),
            },
            identity: identity(stat),
          });
          await walk(pinned, entryPath);
        } finally {
          await pinned.close();
        }
      } else if (entry.isFile()) {
        const pinned = await regular(directory, entry.name);
        try {
          output.push({
            entry: {
              path: entryPath,
              type: "file",
              mode: mode(pinned.stat.mode),
              sha256: sha256(await pinned.handle.readFile()),
            },
            identity: identity(pinned.stat),
          });
        } finally {
          await pinned.handle.close();
        }
      } else {
        throw new Error(
          `Legacy migration refused: unsupported entry at ${entryPath}`,
        );
      }
    }
  };
  await walk(version);
  return output.sort((left, right) =>
    left.entry.path.localeCompare(right.entry.path),
  );
}

function validateFingerprintContract(fingerprint: LegacyFingerprint) {
  if (
    fingerprint.schemaVersion !== 1 ||
    fingerprint.legacyVersion !== VERSION ||
    fingerprint.legacyPluginId !== "elon-musk-agents.senior-product-manager"
  )
    throw new Error(
      "Legacy migration refused: unsupported fingerprint identity",
    );
  if (
    canonical(fingerprint.runtimeVersions) !== canonical([VERSION]) ||
    fingerprint.runtimeRoot !== RUNTIME
  )
    throw new Error("Legacy migration refused: unsupported runtime shape");
  if (
    fingerprint.requirements?.zeroSymlinks !== true ||
    fingerprint.requirements?.zeroExtraRuntimeEntries !== true
  )
    throw new Error(
      "Legacy migration refused: incomplete fingerprint requirements",
    );
  if (
    fingerprint.wrapper.path !== WRAPPER ||
    fingerprint.wrapper.type !== "file" ||
    !fingerprint.wrapper.sha256
  )
    throw new Error("Legacy migration refused: unsupported wrapper contract");
  const paths = new Set<string>();
  for (const entry of fingerprint.entries) {
    safeRelative(entry.path);
    if (
      !entry.path.startsWith(`${RUNTIME}/${VERSION}/`) ||
      paths.has(entry.path)
    )
      throw new Error(
        "Legacy migration refused: invalid or duplicate runtime entry",
      );
    paths.add(entry.path);
    if (entry.type === "file" ? !entry.sha256 : entry.sha256 !== undefined)
      throw new Error("Legacy migration refused: incomplete entry identity");
  }
}

async function openVerifiedLegacy(
  configRoot: string,
  fingerprint: LegacyFingerprint,
  pinnedConfig?: FileHandle,
): Promise<LegacyTree> {
  validateFingerprintContract(fingerprint);
  let config: FileHandle | undefined,
    plugins: FileHandle | undefined,
    runtime: FileHandle | undefined,
    version: FileHandle | undefined;
  try {
    config = pinnedConfig
      ? await duplicateDirectory(pinnedConfig)
      : await pinAbsolute(configRoot);
    plugins = await child(config, WRAPPER_DIRECTORY);
    runtime = await child(config, RUNTIME);
    version = await child(runtime, VERSION);
    const [configStat, pluginsStat, runtimeStat, versionStat] =
      await Promise.all([
        config.stat({ bigint: true }),
        plugins.stat({ bigint: true }),
        runtime.stat({ bigint: true }),
        version.stat({ bigint: true }),
      ]);
    if (
      canonical((await entries(runtime)).map((entry) => entry.name).sort()) !==
      canonical([VERSION])
    )
      throw new Error(
        "Legacy migration refused: runtime versions or extras differ",
      );
    const wrapper = await regular(plugins, WRAPPER_NAME);
    let wrapperIdentity: Identity;
    try {
      wrapperIdentity = identity(wrapper.stat);
      if (
        mode(wrapper.stat.mode) !== fingerprint.wrapper.mode ||
        sha256(await wrapper.handle.readFile()) !== fingerprint.wrapper.sha256
      )
        throw new Error(
          "Legacy migration refused: wrapper fingerprint differs",
        );
    } finally {
      await wrapper.handle.close();
    }
    const actual = (await snapshotVersion(version)).map(
      (snapshot) => snapshot.entry,
    );
    const expected = [...fingerprint.entries].sort((left, right) =>
      left.path.localeCompare(right.path),
    );
    if (canonicalEntries(actual) !== canonicalEntries(expected))
      throw new Error(
        "Legacy migration refused: complete runtime fingerprint differs",
      );
    return {
      configRoot,
      config,
      plugins,
      runtime,
      version,
      configIdentity: identity(configStat),
      pluginsIdentity: identity(pluginsStat),
      runtimeIdentity: identity(runtimeStat),
      versionIdentity: identity(versionStat),
      wrapperIdentity,
    };
  } catch (error) {
    await closeAll([version, runtime, plugins, config]);
    throw error;
  }
}

async function assertPreMoveTree(
  tree: LegacyTree,
  wrapperPresent: boolean,
  runtimePresent: boolean,
) {
  await assertHandleIdentity(
    tree.config,
    tree.configIdentity,
    "config descriptor",
  );
  await assertAbsoluteIdentity(
    tree.configRoot,
    tree.configIdentity,
    "config pathname",
  );
  await assertChildIdentity(
    tree.config,
    WRAPPER_DIRECTORY,
    tree.pluginsIdentity,
    "plugins parent",
  );
  if (wrapperPresent)
    await assertRegularIdentity(
      tree.plugins,
      WRAPPER_NAME,
      tree.wrapperIdentity,
      "wrapper target",
    );
  else if (await presentAt(tree.plugins, WRAPPER_NAME))
    throw new Error("Legacy migration refused: wrapper target reappeared");
  if (runtimePresent) {
    await assertChildIdentity(
      tree.config,
      RUNTIME,
      tree.runtimeIdentity,
      "runtime parent",
    );
    await assertChildIdentity(
      tree.runtime,
      VERSION,
      tree.versionIdentity,
      "version target",
    );
  } else if (await presentAt(tree.config, RUNTIME))
    throw new Error("Legacy migration refused: runtime target reappeared");
}

async function verifyQuarantine(
  quarantine: FileHandle,
  quarantineIdentity: Identity,
  fingerprint: LegacyFingerprint,
) {
  await assertHandleIdentity(
    quarantine,
    quarantineIdentity,
    "quarantine descriptor",
  );
  const top = (await entries(quarantine)).map((entry) => entry.name).sort();
  if (canonical(top) !== canonical([RUNTIME, "wrapper.js"].sort()))
    throw new Error("Legacy migration refused: quarantine inventory differs");
  const wrapper = await regular(quarantine, "wrapper.js");
  let wrapperSnapshot: Snapshot;
  try {
    wrapperSnapshot = {
      entry: { ...fingerprint.wrapper, path: "wrapper.js" },
      identity: identity(wrapper.stat),
    };
    if (
      mode(wrapper.stat.mode) !== fingerprint.wrapper.mode ||
      sha256(await wrapper.handle.readFile()) !== fingerprint.wrapper.sha256
    )
      throw new Error("Legacy migration refused: quarantined wrapper differs");
  } finally {
    await wrapper.handle.close();
  }
  const runtime = await child(quarantine, RUNTIME);
  let runtimeIdentity: Identity;
  try {
    runtimeIdentity = identity(await runtime.stat({ bigint: true }));
    if (
      canonical((await entries(runtime)).map((entry) => entry.name).sort()) !==
      canonical([VERSION])
    )
      throw new Error(
        "Legacy migration refused: quarantined runtime versions differ",
      );
    const version = await child(runtime, VERSION);
    try {
      const versionIdentity = identity(await version.stat({ bigint: true }));
      const snapshots = await snapshotVersion(version);
      const actual = snapshots.map((snapshot) => snapshot.entry);
      const expected = [...fingerprint.entries].sort((left, right) =>
        left.path.localeCompare(right.path),
      );
      if (canonicalEntries(actual) !== canonicalEntries(expected))
        throw new Error(
          "Legacy migration refused: quarantined fingerprint differs",
        );
      return {
        wrapper: wrapperSnapshot,
        runtimeIdentity,
        versionIdentity,
        entries: snapshots,
      };
    } finally {
      await version.close();
    }
  } finally {
    await runtime.close();
  }
}

async function locate(root: FileHandle, relative: string) {
  const parts = safeRelative(relative);
  let directory = root;
  const opened: FileHandle[] = [];
  for (const part of parts.slice(0, -1)) {
    directory = await child(directory, part);
    opened.push(directory);
  }
  return { directory, name: parts.at(-1)!, opened };
}

async function unlinkSnapshot(
  directory: FileHandle,
  name: string,
  snapshot: Snapshot,
) {
  const first = await regular(directory, name);
  try {
    if (
      !sameIdentity(identity(first.stat), snapshot.identity) ||
      mode(first.stat.mode) !== snapshot.entry.mode ||
      sha256(await first.handle.readFile()) !== snapshot.entry.sha256
    )
      throw new Error(`Quarantine file changed: ${snapshot.entry.path}`);
    const second = await regular(directory, name);
    try {
      if (!sameIdentity(identity(second.stat), snapshot.identity))
        throw new Error(
          `Quarantine file identity changed: ${snapshot.entry.path}`,
        );
    } finally {
      await second.handle.close();
    }
    await unlink(fdPath(directory, name));
  } finally {
    await first.handle.close();
  }
}

async function removeEmptySnapshot(
  parent: FileHandle,
  name: string,
  expected: Identity,
  label: string,
) {
  const directory = await child(parent, name);
  try {
    await assertHandleIdentity(directory, expected, label);
    if ((await entries(directory)).length)
      throw new Error(`Quarantine directory is not empty: ${label}`);
    await rmdir(fdPath(parent, name));
  } finally {
    await directory.close();
  }
}

async function cleanupQuarantine(
  tree: LegacyTree,
  quarantine: FileHandle,
  quarantineName: string,
  quarantineIdentity: Identity,
  fingerprint: LegacyFingerprint,
  hook?: (point: string) => void | Promise<void>,
) {
  const snapshot = await verifyQuarantine(
    quarantine,
    quarantineIdentity,
    fingerprint,
  );
  const runtime = await child(quarantine, RUNTIME);
  const version = await child(runtime, VERSION);
  try {
    const files = snapshot.entries
      .filter((item) => item.entry.type === "file")
      .sort((left, right) => right.entry.path.localeCompare(left.entry.path));
    for (const file of files) {
      const relative = file.entry.path.slice(`${RUNTIME}/${VERSION}/`.length);
      await hook?.(`legacy-migration:before-delete:${relative}`);
      await assertAbsoluteIdentity(
        tree.configRoot,
        tree.configIdentity,
        "config pathname",
      );
      await assertChildIdentity(
        tree.config,
        quarantineName,
        quarantineIdentity,
        "quarantine pathname",
      );
      const located = await locate(version, relative);
      try {
        await unlinkSnapshot(located.directory, located.name, file);
      } finally {
        await closeAll(located.opened);
      }
    }
    const directories = snapshot.entries
      .filter((item) => item.entry.type === "directory")
      .sort(
        (left, right) =>
          right.entry.path.split("/").length -
            left.entry.path.split("/").length ||
          right.entry.path.localeCompare(left.entry.path),
      );
    for (const directory of directories) {
      const relative = directory.entry.path.slice(
        `${RUNTIME}/${VERSION}/`.length,
      );
      await hook?.(`legacy-migration:before-prune:${relative}`);
      await assertChildIdentity(
        tree.config,
        quarantineName,
        quarantineIdentity,
        "quarantine pathname",
      );
      const located = await locate(version, relative);
      try {
        await removeEmptySnapshot(
          located.directory,
          located.name,
          directory.identity,
          directory.entry.path,
        );
      } finally {
        await closeAll(located.opened);
      }
    }
    await removeEmptySnapshot(
      runtime,
      VERSION,
      snapshot.versionIdentity,
      `${RUNTIME}/${VERSION}`,
    );
  } finally {
    await closeAll([version, runtime]);
  }
  await removeEmptySnapshot(
    quarantine,
    RUNTIME,
    snapshot.runtimeIdentity,
    RUNTIME,
  );
  await hook?.("legacy-migration:before-delete:wrapper");
  await assertChildIdentity(
    tree.config,
    quarantineName,
    quarantineIdentity,
    "quarantine pathname",
  );
  await unlinkSnapshot(quarantine, "wrapper.js", snapshot.wrapper);
  await hook?.("legacy-migration:before-remove-quarantine");
  await assertChildIdentity(
    tree.config,
    quarantineName,
    quarantineIdentity,
    "quarantine pathname",
  );
  await removeEmptySnapshot(
    tree.config,
    quarantineName,
    quarantineIdentity,
    quarantineName,
  );
}

function recovery(
  quarantine: string,
  diagnostic: string,
  restorationFailures: string[] = [],
): LegacyMigrationResult {
  return {
    migratedFrom: VERSION,
    cleanupRequired: true,
    recoveryRequired: true,
    quarantine,
    diagnostic,
    restorationFailures,
  };
}

export async function ownedInstallationPresence(configRoot: string) {
  return {
    wrapper: await lstat(path.join(configRoot, WRAPPER)).then(
      () => true,
      (error) =>
        (error as NodeJS.ErrnoException).code === "ENOENT"
          ? false
          : Promise.reject(error),
    ),
    runtime: await lstat(path.join(configRoot, RUNTIME)).then(
      () => true,
      (error) =>
        (error as NodeJS.ErrnoException).code === "ENOENT"
          ? false
          : Promise.reject(error),
    ),
  };
}

export async function verifyKnownLegacyInstall(
  configRoot: string,
  fingerprint: LegacyFingerprint,
) {
  const tree = await openVerifiedLegacy(configRoot, fingerprint);
  try {
    return {
      wrapperIdentity: tree.wrapperIdentity,
      runtimeIdentity: tree.runtimeIdentity,
      versionIdentity: tree.versionIdentity,
    };
  } finally {
    await closeAll([tree.version, tree.runtime, tree.plugins, tree.config]);
  }
}

export async function readLegacyFingerprint(
  file: string,
  expectedSha256?: string,
): Promise<LegacyFingerprint> {
  const bytes = await readFile(file);
  if (expectedSha256 && sha256(bytes) !== expectedSha256)
    throw new Error("Legacy migration refused: bundled fingerprint digest differs");
  return JSON.parse(bytes.toString("utf8")) as LegacyFingerprint;
}

export async function migrateKnownLegacyInstall(
  configRoot: string,
  fingerprint: LegacyFingerprint,
  installNeutral: (pinnedConfig: FileHandle) => Promise<unknown>,
  verifyNeutral: (pinnedConfig: FileHandle) => Promise<unknown>,
  uninstallNeutral: (pinnedConfig: FileHandle) => Promise<unknown>,
  hook?: (point: string) => void | Promise<void>,
): Promise<LegacyMigrationResult> {
  const tree = await openVerifiedLegacy(configRoot, fingerprint);
  const quarantineName = `${QUARANTINE_PREFIX}${randomBytes(8).toString("hex")}`;
  let quarantine: FileHandle | undefined;
  let quarantineIdentity: Identity | undefined;
  let movedWrapper = false;
  let movedRuntime = false;
  let neutralInstalled = false;
  let committed = false;
  try {
    await hook?.("legacy-migration:before-full-reverify");
    const reverified = await openVerifiedLegacy(
      configRoot,
      fingerprint,
      tree.config,
    );
    await closeAll([
      reverified.version,
      reverified.runtime,
      reverified.plugins,
      reverified.config,
    ]);
    await assertPreMoveTree(tree, true, true);
    if (
      (await entries(tree.config)).some((entry) =>
        entry.name.startsWith(QUARANTINE_PREFIX),
      )
    )
      throw new Error(
        "Legacy migration refused: existing migration quarantine requires recovery",
      );
    await mkdir(fdPath(tree.config, quarantineName), { mode: 0o700 });
    quarantine = await child(tree.config, quarantineName);
    quarantineIdentity = identity(await quarantine.stat({ bigint: true }));

    await hook?.("legacy-migration:before-move-wrapper");
    await assertPreMoveTree(tree, true, true);
    await rename(
      fdPath(tree.plugins, WRAPPER_NAME),
      fdPath(quarantine, "wrapper.js"),
    );
    movedWrapper = true;
    await assertRegularIdentity(
      quarantine,
      "wrapper.js",
      tree.wrapperIdentity,
      "quarantined wrapper",
    );
    await hook?.("legacy-migration:after-move-wrapper");

    await hook?.("legacy-migration:before-move-runtime");
    await assertPreMoveTree(tree, false, true);
    await assertChildIdentity(
      tree.config,
      quarantineName,
      quarantineIdentity,
      "quarantine pathname",
    );
    await rename(fdPath(tree.config, RUNTIME), fdPath(quarantine, RUNTIME));
    movedRuntime = true;
    await assertChildIdentity(
      quarantine,
      RUNTIME,
      tree.runtimeIdentity,
      "quarantined runtime",
    );
    await hook?.("legacy-migration:after-quarantine");
    await verifyQuarantine(quarantine, quarantineIdentity, fingerprint);
    await hook?.("legacy-migration:after-quarantine-reverify");
    await assertPreMoveTree(tree, false, false);

    await installNeutral(tree.config);
    neutralInstalled = true;
    await hook?.("legacy-migration:after-neutral-install-before-commit");
    await assertAbsoluteIdentity(
      tree.configRoot,
      tree.configIdentity,
      "config pathname",
    );
    await verifyNeutral(tree.config);
    await assertChildIdentity(
      tree.config,
      quarantineName,
      quarantineIdentity,
      "quarantine pathname",
    );
    await verifyQuarantine(quarantine, quarantineIdentity, fingerprint);
    committed = true;

    try {
      await hook?.("legacy-migration:before-quarantine-cleanup");
      await cleanupQuarantine(
        tree,
        quarantine,
        quarantineName,
        quarantineIdentity,
        fingerprint,
        hook,
      );
      await quarantine.close();
      quarantine = undefined;
      return {
        migratedFrom: VERSION,
        cleanupRequired: false,
        recoveryRequired: false,
      };
    } catch (error) {
      return recovery(
        quarantineName,
        `Neutral installation committed; verified legacy quarantine cleanup requires recovery: ${(error as Error).message}`,
      );
    }
  } catch (error) {
    if (committed)
      return recovery(
        quarantineName,
        `Neutral installation committed; cleanup requires recovery: ${(error as Error).message}`,
      );
    const failures: string[] = [];
    if (neutralInstalled) {
      try {
        const result = (await uninstallNeutral(tree.config)) as
          | {
              cleanupRequired?: boolean;
              recoveryRequired?: boolean;
              diagnostic?: string;
            }
          | undefined;
        if (result?.cleanupRequired || result?.recoveryRequired)
          failures.push(
            `neutral cleanup: ${result.diagnostic ?? "cleanup incomplete"}`,
          );
      } catch (cleanupError) {
        failures.push(`neutral cleanup: ${(cleanupError as Error).message}`);
      }
    }
    if (!quarantine || !quarantineIdentity)
      failures.push("quarantine unavailable");
    if (!failures.length && quarantine && quarantineIdentity) {
      try {
        await assertHandleIdentity(
          tree.config,
          tree.configIdentity,
          "config descriptor",
        );
        if (movedRuntime) {
          await hook?.("legacy-migration:before-restore-runtime");
          await verifyQuarantine(quarantine, quarantineIdentity, fingerprint);
          if (await presentAt(tree.config, RUNTIME))
            throw new Error("runtime destination is occupied");
          await rename(
            fdPath(quarantine, RUNTIME),
            fdPath(tree.config, RUNTIME),
          );
          movedRuntime = false;
        }
        if (movedWrapper) {
          await hook?.("legacy-migration:before-restore-wrapper");
          await assertChildIdentity(
            tree.config,
            WRAPPER_DIRECTORY,
            tree.pluginsIdentity,
            "plugins restoration parent",
          );
          await assertRegularIdentity(
            quarantine,
            "wrapper.js",
            tree.wrapperIdentity,
            "quarantined wrapper",
          );
          if (await presentAt(tree.plugins, WRAPPER_NAME))
            throw new Error("wrapper destination is occupied");
          await rename(
            fdPath(quarantine, "wrapper.js"),
            fdPath(tree.plugins, WRAPPER_NAME),
          );
          movedWrapper = false;
        }
        const restored = await openVerifiedLegacy(
          configRoot,
          fingerprint,
          tree.config,
        );
        await closeAll([
          restored.version,
          restored.runtime,
          restored.plugins,
          restored.config,
        ]);
        if ((await entries(quarantine)).length)
          return recovery(
            quarantineName,
            `Exact legacy paths restored but quarantine contains unexpected entries; cause: ${(error as Error).message}`,
          );
        await assertChildIdentity(
          tree.config,
          quarantineName,
          quarantineIdentity,
          "quarantine pathname",
        );
        await rmdir(fdPath(tree.config, quarantineName));
        await quarantine.close();
        quarantine = undefined;
      } catch (restoreError) {
        failures.push(`restoration: ${(restoreError as Error).message}`);
      }
    }
    if (failures.length)
      return recovery(
        quarantineName,
        `Legacy migration failed and exact restoration was incomplete; cause: ${(error as Error).message}`,
        failures,
      );
    throw error;
  } finally {
    await quarantine?.close().catch(() => undefined);
    await closeAll([tree.version, tree.runtime, tree.plugins, tree.config]);
  }
}
