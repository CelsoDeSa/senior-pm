import { writeRevision } from "../../../dist/spec/index.js";
const input=JSON.parse(process.env.SPEC_INPUT);try{const result=await writeRevision(process.argv[2],input);process.stdout.write(JSON.stringify({ok:true,base:result.base}));}catch(error){process.stdout.write(JSON.stringify({ok:false,error:error.message}));process.exitCode=2;}
