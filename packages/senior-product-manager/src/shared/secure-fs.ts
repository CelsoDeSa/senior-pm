import { constants } from "node:fs";
import { lstat, mkdir, open, realpath, type FileHandle } from "node:fs/promises";
import path from "node:path";

export type DescriptorResolver = (fd: number) => Promise<string>;
export const procDescriptorTarget: DescriptorResolver = fd => realpath(`/proc/self/fd/${fd}`);
export function secureFdSupported(platform = process.platform): boolean { return platform === "linux"; }
export class PinnedRepositoryRoot {
  private closed = false;
  private constructor(readonly canonicalPath: string, private readonly handle: FileHandle, readonly dev: bigint, readonly ino: bigint) {}
  static async open(input: string) { const canonical=await realpath(input),handle=await open(canonical,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);try{const info=await handle.stat({bigint:true});if(!info.isDirectory())throw new Error("Repository root is not a directory");return new PinnedRepositoryRoot(canonical,handle,info.dev,info.ino);}catch(error){await handle.close();throw error;} }
  get descriptorPath(){if(this.closed)throw new Error("Pinned repository root is closed");return `/proc/self/fd/${this.handle.fd}`;}
  async duplicate(){const duplicate=await open(this.descriptorPath,constants.O_RDONLY|constants.O_DIRECTORY);try{const info=await duplicate.stat({bigint:true});if(info.dev!==this.dev||info.ino!==this.ino)throw new Error("Pinned repository identity changed");return duplicate;}catch(error){await duplicate.close();throw error;}}
  async assertIdentity(){const info=await this.handle.stat({bigint:true});if(info.dev!==this.dev||info.ino!==this.ino)throw new Error("Pinned repository identity changed");}
  async close(){if(!this.closed){this.closed=true;await this.handle.close();}}
}
export type RepositoryRoot = string | PinnedRepositoryRoot;
export const repositoryCanonicalPath = async (root:RepositoryRoot)=>root instanceof PinnedRepositoryRoot?root.canonicalPath:realpath(root);
export const repositoryDescriptorPath = (root:RepositoryRoot)=>root instanceof PinnedRepositoryRoot?root.descriptorPath:root;
function cleanTarget(target: string) { return target.endsWith(" (deleted)") ? target.slice(0, -10) : target; }
export async function assertDescriptorTarget(handle: FileHandle, expected: string, root: string, resolveTarget: DescriptorResolver = procDescriptorTarget) {
  const actual = cleanTarget(await resolveTarget(handle.fd));
  if (actual !== expected || (actual !== root && !actual.startsWith(`${root}${path.sep}`))) throw new Error("Secure descriptor target mismatch");
  return actual;
}
export async function openPinnedDirectory(openPath: string, root: string, resolveTarget?: DescriptorResolver, expectedTarget = openPath) {
  if (!secureFdSupported()) throw new Error("Secure descriptor-relative IO is unsupported on this platform");
  const handle = await open(openPath, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try { const stat = await handle.stat(); if (!stat.isDirectory()) throw new Error("Pinned target is not a directory"); await assertDescriptorTarget(handle, expectedTarget, root, resolveTarget);if(path.isAbsolute(expectedTarget)&&!expectedTarget.startsWith("/proc/")){const current=await lstat(expectedTarget);if(current.isSymbolicLink()||current.dev!==stat.dev||current.ino!==stat.ino)throw new Error("Pinned directory pathname changed");} return handle; } catch (error) { await handle.close(); throw error; }
}
export function fdChild(directory: FileHandle, name: string) { if (!name || name === "." || name === ".." || name.includes("/") || name.includes("\\") || name.includes("\0")) throw new Error("Invalid descriptor-relative child"); return `/proc/self/fd/${directory.fd}/${name}`; }
export async function openPinnedRegular(directory: FileHandle, name: string, expected: string, root: string, flags: number | string = constants.O_RDONLY, resolveTarget?: DescriptorResolver) {
  const handle = await open(fdChild(directory, name), typeof flags === "number" ? flags | constants.O_NOFOLLOW : flags);
  try { const stat = await handle.stat(); if (!stat.isFile()) throw new Error("Pinned target is not a regular file"); await assertDescriptorTarget(handle, expected, root, resolveTarget); return handle; } catch (error) { await handle.close(); throw error; }
}
export async function mkdirPinnedChild(directory: FileHandle, name: string) { await mkdir(fdChild(directory, name)); }
