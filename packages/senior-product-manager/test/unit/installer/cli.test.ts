import { mkdir, mkdtemp, rename } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runCli } from "../../../src/cli.js";
import type { PinnedRepositoryRoot } from "../../../src/shared/secure-fs.js";

const io=()=>{const out:string[]=[],err:string[]=[];return {out,err,adapter:{out:(x:string)=>out.push(x),err:(x:string)=>err.push(x)}};};
describe("installer CLI security",()=>{
  it("returns zero only for complete install/uninstall outcomes",async()=>{const a=io();expect(await runCli(["install","--scope","project"],a.adapter,{installCommand:async()=>({idempotent:false}) as never})).toBe(0);const b=io();expect(await runCli(["uninstall","--scope","project"],b.adapter,{uninstallCommand:async()=>({cleanupRequired:true,recoveryRequired:false}) as never})).toBe(1);const c=io();expect(await runCli(["uninstall","--scope","project"],c.adapter,{uninstallCommand:async()=>({cleanupRequired:true,recoveryRequired:true}) as never})).toBe(1);const d=io();expect(await runCli(["install","--scope","project"],d.adapter,{installCommand:async()=>{throw new Error("refused");}})).toBe(2);});
  it("keeps validate on the pinned repository after pathname replacement and closes it",async()=>{const parent=await mkdtemp(path.join(os.tmpdir(),"pm-cli-pin-")),repository=path.join(parent,"repository"),moved=path.join(parent,"moved");await mkdir(repository);let pinned:PinnedRepositoryRoot|undefined;const result=await runCli(["validate","--repository",repository,"--output-root","artifacts","--artifact-base","thing.r1"],io().adapter,{afterRepositoryPinned:async root=>{pinned=root;await rename(repository,moved);await mkdir(repository);}});expect(result).toBe(1);expect(pinned).toBeDefined();expect(()=>pinned!.descriptorPath).toThrow(/closed/);});
});
