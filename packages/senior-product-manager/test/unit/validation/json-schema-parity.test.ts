import { readFile } from "node:fs/promises";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import { evaluateSpec } from "../../../src/validation/validate.js";
import { renderSpec, artifactManifest } from "../../../src/spec/render.js";
import { specFixture } from "../spec/fixture.js";
import { DESIGN_REVIEW_SCHEMA_ID, LEGACY_DESIGN_REVIEW_SCHEMA_ID, LEGACY_SPEC_SCHEMA_ID, SPEC_SCHEMA_ID } from "../../../src/spec/contract.js";
const Ajv:any=(Ajv2020 as any).default??Ajv2020,formats:any=(addFormats as any).default??addFormats;

const directory=path.resolve(import.meta.dirname,"../../../schemas");
async function schema(name:string){return JSON.parse(await readFile(path.join(directory,name),"utf8"));}
describe("executable packaged JSON Schema parity",()=>{
  it("accepts representative valid documents and rejects adversarial formats/bounds",async()=>{
    const ajv=new Ajv({allErrors:true,strict:false});formats(ajv);
    const specSchema=await schema("senior-pm-spec.schema.json");ajv.addSchema(specSchema,"senior-pm-spec.schema.json");
    const input=specFixture(),spec=evaluateSpec(input),rendered=renderSpec(spec),hash="a".repeat(64);
    const docs:Record<string,unknown>={
      "senior-pm-config.schema.json":{senior_pm:{enabled:true,mode:"interactive"}},
      "senior-pm-spec.schema.json":spec,
      "senior-pm-design-review.schema.json":{schemaVersion:"1.0.0",specId:spec.specId,revision:1,productContentHash:spec.productContentHash,decision:"approved",reviewer:{id:"designer",name:"Designer"},reviewedAt:"2026-07-18T13:00:00.000Z",evidence:"review"},
      "senior-pm-handoff.schema.json":JSON.parse(rendered.handoffJson),
      "senior-pm-manifest.schema.json":JSON.parse(artifactManifest(spec,rendered)),
      "senior-pm-prior-artifact.schema.json":{schemaVersion:"1.0.0",specId:spec.specId,slug:spec.slug,hostIdentifier:spec.hostIdentifier,revision:1,base:"sample.r001"},
    };
    for(const [name,document] of Object.entries(docs)){const raw=await schema(name),validate=name==="senior-pm-spec.schema.json"?ajv.getSchema("senior-pm-spec.schema.json")!:ajv.compile(raw);expect(validate(document),`${name}: ${ajv.errorsText(validate.errors)}`).toBe(true);}
    const design=ajv.getSchema(DESIGN_REVIEW_SCHEMA_ID)!;expect(design({...docs["senior-pm-design-review.schema.json"] as object,reviewedAt:"not-a-date"})).toBe(false);
    const prior=ajv.compile(await schema("senior-pm-prior-artifact.schema.json"));expect(prior({...docs["senior-pm-prior-artifact.schema.json"] as object,base:"../escape"})).toBe(false);
    const manifest=ajv.compile(await schema("senior-pm-manifest.schema.json"));expect(manifest({...docs["senior-pm-manifest.schema.json"] as object,canonicalContentHash:"bad"})).toBe(false);
    const config=ajv.compile(await schema("senior-pm-config.schema.json"));expect(config({senior_pm:{mode:"unsafe"}})).toBe(false);
    const handoff=ajv.compile(await schema("senior-pm-handoff.schema.json"));expect(handoff({...docs["senior-pm-handoff.schema.json"] as object,productContentHash:"bad"})).toBe(false);
    const specValidate=ajv.getSchema("senior-pm-spec.schema.json")!;expect(specValidate({...spec,title:"x".repeat(20_001)})).toBe(false);
    void hash;
  });
  it("ships exactly two canonical IDs and two frozen legacy aliases",async()=>{const spec=await schema("senior-pm-spec.schema.json"),design=await schema("senior-pm-design-review.schema.json"),legacySpec=await schema("legacy/senior-pm-spec.legacy.schema.json"),legacyDesign=await schema("legacy/senior-pm-design-review.legacy.schema.json");expect(spec.$id).toBe(SPEC_SCHEMA_ID);expect(design.$id).toBe(DESIGN_REVIEW_SCHEMA_ID);expect(legacySpec.$id).toBe(LEGACY_SPEC_SCHEMA_ID);expect(legacyDesign.$id).toBe(LEGACY_DESIGN_REVIEW_SCHEMA_ID);for(const name of ["senior-pm-config.schema.json","senior-pm-handoff.schema.json","senior-pm-manifest.schema.json","senior-pm-prior-artifact.schema.json"])expect((await schema(name)).$id).toBeUndefined();});
});
