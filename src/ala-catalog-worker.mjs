// Catalog-only ALA adapter. Never starts a prompt, task, or model inference.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const [entrypoint,agent]=process.argv.slice(2);
let workspace;
try{
 const entry=await fs.realpath(entrypoint),alaRoot=path.dirname(path.dirname(entry));
 const {discoverCodingAgents}=await import(pathToFileURL(path.join(alaRoot,'src/coding-agents/discovery.mjs')));
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('PLOINKY_')));
 const agents=await discoverCodingAgents({env});
 if(!agent)process.stdout.write(JSON.stringify({agents:agents.map(a=>({id:a.name,label:a.name,available:!!a.available}))}));
 else{
  if(!agents.some(a=>a.name===agent&&a.available))throw Error('The selected coding agent is not installed.');
  const {createCodingAgentService}=await import(pathToFileURL(path.join(alaRoot,'src/coding-agents/service.mjs')));
  workspace=await fs.mkdtemp(path.join(os.tmpdir(),'analyst-catalog-'));
  const service=createCodingAgentService({agents,workspace,env});
  const models=await service.listModels(agent,{details:true,signal:AbortSignal.timeout(20000)});
  if(!Array.isArray(models))throw Error('ALA returned an invalid model catalog.');
  process.stdout.write(JSON.stringify({models:models.map(m=>typeof m==='string'?{id:m,label:m}:{id:m.id,label:m.label||m.id,efforts:Array.isArray(m.efforts)?m.efforts:[]})}));
 }
}catch(error){process.stderr.write(error.message+'\n');process.exitCode=1;}
finally{if(workspace)await fs.rm(workspace,{recursive:true,force:true});}
