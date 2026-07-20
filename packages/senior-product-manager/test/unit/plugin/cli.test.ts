import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runCli } from "../../../src/cli.js";
import { writeRevision } from "../../../src/spec/writer.js";
import { specFixture } from "../spec/fixture.js";

describe("CLI current-policy validation",()=>{
  it("refuses an artifact created under a weaker historical policy",async()=>{
    const repository=await mkdtemp(path.join(os.tmpdir(),"spm-cli-policy-")),written=await writeRevision(repository,specFixture());
    await mkdir(path.join(repository,".opencode"),{recursive:true});
    await writeFile(path.join(repository,".opencode/senior-pm.json"),JSON.stringify({senior_pm:{required_specification_sections:["security-notes"]}}));
    const out:string[]=[],err:string[]=[],code=await runCli(["validate","--repository",repository,"--output-root",written.outputRoot,"--artifact-base",written.base],{out:value=>out.push(value),err:value=>err.push(value)});
    expect(code).toBe(1);expect(err).toEqual([]);expect(JSON.parse(out[0]!)).toMatchObject({valid:false,revisionRequired:true,handoffEligible:false});expect(out[0]).toContain("policy_outdated");
  });
});
