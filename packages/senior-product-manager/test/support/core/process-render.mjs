import { writeFile } from "node:fs/promises";
import { evaluateSpec } from "../../../dist/validation/index.js";
import { renderSpec } from "../../../dist/spec/index.js";
const input=JSON.parse(process.env.SPEC_INPUT);const rendered=renderSpec(evaluateSpec(input));await writeFile(process.argv[2],JSON.stringify(rendered));
