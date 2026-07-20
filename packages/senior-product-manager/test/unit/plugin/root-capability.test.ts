import { mkdir, mkdtemp, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PinnedRepositoryRoot } from "../../../src/shared/secure-fs.js";
import { discoverRepository } from "../../../src/repository/discover.js";
import { writeRevision } from "../../../src/spec/writer.js";
import { validateArtifactSet } from "../../../src/validation/artifacts.js";
import { specFixture } from "../spec/fixture.js";

describe("pinned repository capability",()=>{
  it("never reads or writes a pathname replacement",async()=>{const root=await mkdtemp(path.join(os.tmpdir(),"spm-cap-"));await writeFile(path.join(root,"original.txt"),"original evidence");const pinned=await PinnedRepositoryRoot.open(root);try{await rename(root,`${root}-old`);await mkdir(root);await writeFile(path.join(root,"replacement.txt"),"replacement secret");const discovered=await discoverRepository(pinned);expect(JSON.stringify(discovered)).not.toContain("replacement secret");await expect(writeRevision(pinned,specFixture())).rejects.toThrow();expect((await validateArtifactSet(pinned,".opencode/specs/senior-pm","sample.r001")).valid).toBe(false);}finally{await pinned.close();}});
});
